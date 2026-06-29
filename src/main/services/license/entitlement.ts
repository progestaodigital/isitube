// Cryptographic verification of the signed entitlement token (JWT/EdDSA) that
// the isipanel includes — ONLY on a `valid` validate response — in a new,
// optional `entitlement` field.
//
// Why this exists: until now the app trusted the raw JSON from
// `/v1/license/validate`. A tampered or MITM'd `{ status: "valid" }` would be
// believed as-is. The entitlement is an Ed25519-signed JWT whose payload binds
// the result to this machine (hwid), this product (product_slug) and a short
// lifetime (exp = iat + 4h). When the token is PRESENT we trust ONLY the
// signed claims for gating; the JSON becomes auxiliary data (URLs etc.).
//
// The change is ADDITIVE and never mandatory:
//   - token ABSENT  → caller keeps today's behavior (older server / key not yet
//     configured). We NEVER fail hard on absence.
//   - token PRESENT → it must verify, or we refuse to grant access.
//
// Verification uses Node's built-in `crypto` (no extra dependency). The public
// key is embedded as SPKI PEM and loaded once via `crypto.createPublicKey`;
// EdDSA verification is `crypto.verify(null, msg, key, sig)`.

import { app } from 'electron';
import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'node:crypto';
import type { LicensePlan } from '@shared/types';
import type { LicenseSlug } from './storage';

// ---------------------------------------------------------------------------
// Embedded trusted public keys — a { kid -> key } map to support rotation.
//
// Rotation contract: the server may add a new kid and start signing with it.
// Because tokens live 4h, we must (a) embed the NEW pubkey BEFORE the server
// activates its kid, and (b) keep the OLD pubkey valid for ~4h after the
// server stops using it. Accept ANY known kid.
//
// The PRIVATE keys never leave the panel; only these PUBLIC keys ship here.
// ---------------------------------------------------------------------------

/** PRODUCTION key — ships in release/store builds. kid: isi-ed25519-prod-2026-06 */
const PROD_KEYS: Record<string, string> = {
  'isi-ed25519-prod-2026-06': `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAYoNbolc1ExyQJlXY2opb5RG7qxNLz5yqX45Gt+x0ZjE=
-----END PUBLIC KEY-----`,
};

// DEV keys — convenience for local debugging against the dev panel. Kept OUT of
// packaged (release/store) builds: `app.isPackaged` is true only in a real
// build, so these are skipped there. Stored as the raw base64url `x` (32-byte
// Ed25519 public key); the SPKI PEM is derived lazily in `trustedKeys()`.
const DEV_RAW_KEYS: Record<string, string> = {
  'isi-ed25519-2026-06': 'uJNVaOJjkbyJwluIk7n46kbkzUvkr9zgFa0xEuHiCns',
};

/** Fixed ASN.1/DER SPKI header for an Ed25519 (OID 1.3.101.112) public key. */
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/** Build an SPKI PEM from a raw 32-byte Ed25519 public key (base64url `x`). */
function spkiPemFromRawBase64Url(rawB64Url: string): string {
  const raw = base64UrlToBuffer(rawB64Url);
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  const b64 = der.toString('base64').replace(/(.{64})/g, '$1\n');
  return `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`;
}

/**
 * Lazily build the { kid -> KeyObject } map. PROD keys always load; DEV keys
 * load only in unpackaged (development) runs. Built once and memoized. All key
 * parsing happens here (not at module load) so a bad key can't crash import.
 */
let keyMap: Map<string, KeyObject> | null = null;
function trustedKeys(): Map<string, KeyObject> {
  if (keyMap) return keyMap;
  const map = new Map<string, KeyObject>();

  const load = (kid: string, pem: string): void => {
    try {
      map.set(kid, createPublicKey(pem));
    } catch (err) {
      // A malformed embedded key is a build-time mistake; log and skip it so a
      // single bad entry can't take down verification for the other kids.
      console.error(`[entitlement] failed to load embedded key '${kid}':`, err);
    }
  };

  for (const [kid, pem] of Object.entries(PROD_KEYS)) load(kid, pem);
  if (!app.isPackaged) {
    for (const [kid, raw] of Object.entries(DEV_RAW_KEYS)) {
      load(kid, spkiPemFromRawBase64Url(raw));
    }
  }

  keyMap = map;
  return map;
}

// ---------------------------------------------------------------------------
// Token shape
// ---------------------------------------------------------------------------

type EntitlementHeader = { alg?: string; typ?: string; kid?: string };

type EntitlementClaims = {
  sub?: string;
  product_slug?: string;
  edition?: string;
  status?: string;
  hwid?: string;
  iat?: number;
  exp?: number;
  nonce?: string;
  iss?: string;
};

/** Outcome of verifying the `entitlement` field of a `valid` validate response. */
export type EntitlementOutcome =
  | { kind: 'absent' }
  | { kind: 'trusted'; edition: LicensePlan }
  | { kind: 'rejected'; reason: string };

type VerifyParams = {
  /** The `entitlement` string from the validate response (may be undefined/empty). */
  token: string | null | undefined;
  /** Local hwid (SHA-256 hex) — must match the bound `hwid` claim. */
  hwid: string;
  /** The product slug we sent in the request — must match `product_slug`. */
  slug: LicenseSlug;
  /** Current time in epoch SECONDS. */
  nowEpoch: number;
};

/** Small clock skew tolerated for an offline machine, in seconds. */
const CLOCK_SKEW_S = 90;

/** Expected edition for a given product slug (binding: slug ⇒ tier). */
function expectedEditionForSlug(slug: LicenseSlug): LicensePlan {
  return slug === 'isitubepro' ? 'pro' : 'iniciante';
}

/** Tier ordering so we can clamp to the more restrictive edition. */
const TIER_RANK: Record<LicensePlan, number> = { iniciante: 0, pro: 1 };

// ---------------------------------------------------------------------------
// base64url helpers (JWT uses base64url, no padding)
// ---------------------------------------------------------------------------

function base64UrlToBuffer(input: string): Buffer {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

function decodeJsonSegment<T>(segment: string): T | null {
  try {
    return JSON.parse(base64UrlToBuffer(segment).toString('utf8')) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Logging hygiene — never log the whole token, key, or hwid.
// ---------------------------------------------------------------------------

/** Mask an hwid (or any secret-ish hex) as `abcdef…wxyz` keeping a few chars. */
function mask(value: string | undefined): string {
  if (!value) return '∅';
  if (value.length <= 12) return '…';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Verification (order matters — mirrors the panel handoff pseudocode)
// ---------------------------------------------------------------------------

/**
 * Verify the signed entitlement token.
 *
 * Returns:
 *  - `absent`   → no token present; caller keeps today's JSON-based behavior.
 *  - `trusted`  → signature + all bound claims check out; gate off `edition`.
 *  - `rejected` → token present but failed verification; caller must NOT grant
 *                 access (defends against tampered / MITM'd `valid` responses).
 *
 * Never throws.
 */
export function verifyEntitlement(params: VerifyParams): EntitlementOutcome {
  return verifyEntitlementWithKeys(params, trustedKeys());
}

/**
 * Core verification against an explicit `{ kid -> KeyObject }` map. Split out so
 * unit tests can inject an ephemeral keypair (we don't hold the real private
 * keys). Production code goes through `verifyEntitlement`, which passes the
 * embedded trusted map.
 */
export function verifyEntitlementWithKeys(
  params: VerifyParams,
  keys: Map<string, KeyObject>
): EntitlementOutcome {
  const { token, hwid, slug, nowEpoch } = params;

  // 1) Absent → fall back to today's behavior. NEVER fail hard on absence.
  if (token == null || token === '') return { kind: 'absent' };

  const parts = token.split('.');
  if (parts.length !== 3) {
    return reject('formato de token inválido');
  }
  const [headerSeg, payloadSeg, sigSeg] = parts;

  // 2) Header → resolve the trusted public key by kid.
  const header = decodeJsonSegment<EntitlementHeader>(headerSeg);
  if (!header) return reject('header ilegível');
  if (header.alg && header.alg !== 'EdDSA') {
    // Reject alg confusion outright; we only accept EdDSA.
    return reject(`alg inesperado: ${header.alg}`);
  }
  const kid = header.kid ?? '';
  const pub = keys.get(kid);
  if (!pub) {
    return reject(`kid desconhecido: ${kid || '∅'}`);
  }

  // 3) Verify the Ed25519 signature over `header.payload` (ASCII signing input).
  let signatureOk = false;
  try {
    const signingInput = Buffer.from(`${headerSeg}.${payloadSeg}`, 'ascii');
    const signature = base64UrlToBuffer(sigSeg);
    // For Ed25519 the digest algorithm argument MUST be null.
    signatureOk = cryptoVerify(null, signingInput, pub, signature);
  } catch (err) {
    console.warn('[entitlement] signature verification threw:', err);
    return reject('falha ao verificar assinatura');
  }
  if (!signatureOk) return reject('assinatura inválida');

  // 4) Claims — only meaningful now that the signature is trusted.
  const claims = decodeJsonSegment<EntitlementClaims>(payloadSeg);
  if (!claims) return reject('payload ilegível');

  if (claims.status !== 'valid') return reject(`status do token != valid (${claims.status})`);
  if (claims.iss !== 'isipanel') return reject(`issuer inválido (${claims.iss})`);

  // 5) Offline clock defense with a small skew tolerance.
  if (typeof claims.exp !== 'number') return reject('exp ausente');
  if (nowEpoch > claims.exp) return reject('token expirado'); // app should re-boot-ping
  if (typeof claims.iat === 'number' && claims.iat > nowEpoch + CLOCK_SKEW_S) {
    return reject('iat no futuro — relógio suspeito');
  }

  // 6) Binding: machine + product must match what we asked for.
  if (claims.hwid !== hwid) {
    console.warn(
      `[entitlement] hwid mismatch token=${mask(claims.hwid)} local=${mask(hwid)}`
    );
    return reject('hwid não confere');
  }
  if (claims.product_slug !== slug) {
    return reject(`produto não confere (${claims.product_slug} != ${slug})`);
  }

  // 7) Edition. The token is genuinely from the panel (signature checked), so an
  // edition mismatch is a server inconsistency, not an attack: never block on
  // it. Clamp to the MORE RESTRICTIVE of (claimed, expected) so we can never
  // grant a tier above what the slug entitles, and log the anomaly.
  const expected = expectedEditionForSlug(slug);
  const claimed: LicensePlan | null =
    claims.edition === 'iniciante' || claims.edition === 'pro' ? claims.edition : null;

  if (!claimed) {
    return reject(`edition desconhecida (${claims.edition})`);
  }
  let granted = claimed;
  if (claimed !== expected) {
    granted = TIER_RANK[claimed] < TIER_RANK[expected] ? claimed : expected;
    console.warn(
      `[entitlement] edition anomaly slug=${slug} claimed=${claimed} expected=${expected} → granting ${granted}`
    );
  }

  return { kind: 'trusted', edition: granted };
}

function reject(reason: string): EntitlementOutcome {
  console.warn(`[entitlement] rejected: ${reason}`);
  return { kind: 'rejected', reason };
}
