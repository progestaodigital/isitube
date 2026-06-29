// Unit tests for the signed-entitlement verifier. We don't hold the real
// PROD/DEV private keys, so the bulk of the suite uses an ephemeral Ed25519
// keypair injected via `verifyEntitlementWithKeys`. A couple of tests exercise
// the public `verifyEntitlement` (embedded map) for the paths that don't need a
// valid signature (absent token, unknown kid).

import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  generateKeyPairSync,
  sign as edSign,
  createPublicKey,
  type KeyObject,
  type KeyPairKeyObjectResult,
} from 'node:crypto';

// entitlement.ts imports `electron` at module load (for `app.isPackaged`).
// Mock it so the module loads in plain Node. `isPackaged: false` means the
// embedded map also includes the DEV key — irrelevant to the injected-key tests.
vi.mock('electron', () => ({ app: { isPackaged: false } }));

import {
  verifyEntitlement,
  verifyEntitlementWithKeys,
  type EntitlementOutcome,
} from './entitlement';

const KID = 'test-kid';
const HWID = 'a'.repeat(64);
const NOW = 1_700_000_000; // fixed epoch seconds — keeps tests deterministic
const EXP = NOW + 14_400; // iat + 4h

let pair: KeyPairKeyObjectResult;
let keys: Map<string, KeyObject>;

beforeAll(() => {
  pair = generateKeyPairSync('ed25519');
  keys = new Map([[KID, pair.publicKey]]);
});

// --- helpers --------------------------------------------------------------

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

type Claims = Record<string, unknown>;

/** Build a token signed with `pair.privateKey`, overriding header/claims. */
function makeToken(claims: Claims, headerOverride: Record<string, unknown> = {}): string {
  const header = { alg: 'EdDSA', typ: 'JWT', kid: KID, ...headerOverride };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(claims));
  const sig = edSign(null, Buffer.from(`${h}.${p}`, 'ascii'), pair.privateKey);
  return `${h}.${p}.${b64url(sig)}`;
}

/** A fully-valid set of claims for the `isitube`/`iniciante` build. */
function validClaims(over: Claims = {}): Claims {
  return {
    sub: 'license-uuid',
    product_slug: 'isitube',
    edition: 'iniciante',
    status: 'valid',
    hwid: HWID,
    iat: NOW,
    exp: EXP,
    nonce: 'nonce-uuid',
    iss: 'isipanel',
    ...over,
  };
}

function verify(token: string, over: Partial<Parameters<typeof verifyEntitlementWithKeys>[0]> = {}) {
  return verifyEntitlementWithKeys(
    { token, hwid: HWID, slug: 'isitube', nowEpoch: NOW, ...over },
    keys
  );
}

function expectRejected(outcome: EntitlementOutcome): asserts outcome is { kind: 'rejected'; reason: string } {
  expect(outcome.kind).toBe('rejected');
}

// --- happy path -----------------------------------------------------------

describe('verifyEntitlement — happy path', () => {
  it('accepts a well-formed signed token and trusts its edition', () => {
    const outcome = verify(makeToken(validClaims()));
    expect(outcome).toEqual({ kind: 'trusted', edition: 'iniciante' });
  });

  it('accepts a pro token for the isitubepro slug', () => {
    const token = makeToken(validClaims({ product_slug: 'isitubepro', edition: 'pro' }));
    const outcome = verify(token, { slug: 'isitubepro' });
    expect(outcome).toEqual({ kind: 'trusted', edition: 'pro' });
  });

  it('tolerates iat slightly in the future (within 90s skew)', () => {
    const outcome = verify(makeToken(validClaims({ iat: NOW + 60 })));
    expect(outcome.kind).toBe('trusted');
  });
});

// --- absence / fallback ---------------------------------------------------

describe('verifyEntitlement — absent token never fails hard', () => {
  it('returns absent for an empty string', () => {
    expect(verify('').kind).toBe('absent');
  });

  it('returns absent for undefined', () => {
    expect(verify(undefined as unknown as string).kind).toBe('absent');
  });
});

// --- signature / structure ------------------------------------------------

describe('verifyEntitlement — signature & structure', () => {
  it('rejects a tampered payload (signature no longer matches)', () => {
    const token = makeToken(validClaims());
    const [h, , s] = token.split('.');
    const forged = b64url(JSON.stringify(validClaims({ edition: 'pro' })));
    const outcome = verify(`${h}.${forged}.${s}`);
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/assinatura/i);
  });

  it('rejects an unknown kid', () => {
    const token = makeToken(validClaims(), { kid: 'nope' });
    const outcome = verify(token);
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/kid/i);
  });

  it('rejects a non-EdDSA alg (alg confusion)', () => {
    const token = makeToken(validClaims(), { alg: 'HS256' });
    expectRejected(verify(token));
  });

  it('rejects a malformed token (not three segments)', () => {
    expectRejected(verify('only.two'));
  });
});

// --- claim binding --------------------------------------------------------

describe('verifyEntitlement — claim binding', () => {
  it('rejects status != valid', () => {
    expectRejected(verify(makeToken(validClaims({ status: 'expired' }))));
  });

  it('rejects a bad issuer', () => {
    expectRejected(verify(makeToken(validClaims({ iss: 'evil' }))));
  });

  it('rejects an expired token', () => {
    const token = makeToken(validClaims({ exp: NOW - 1 }));
    const outcome = verify(token);
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/expirado/i);
  });

  it('rejects iat too far in the future (beyond skew)', () => {
    const outcome = verify(makeToken(validClaims({ iat: NOW + 91 })));
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/iat/i);
  });

  it('rejects an hwid mismatch', () => {
    const outcome = verify(makeToken(validClaims({ hwid: 'b'.repeat(64) })));
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/hwid/i);
  });

  it('rejects a product_slug that does not match the requested slug', () => {
    // token for isitubepro but the request validated isitube
    const token = makeToken(validClaims({ product_slug: 'isitubepro', edition: 'pro' }));
    const outcome = verify(token, { slug: 'isitube' });
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/produto/i);
  });
});

// --- edition anomaly: clamp, never grant above expected -------------------

describe('verifyEntitlement — edition clamp', () => {
  it('never grants a tier above the slug (isitube + edition=pro → iniciante)', () => {
    // product_slug must still match the requested slug, only edition is off.
    const token = makeToken(validClaims({ edition: 'pro' }));
    const outcome = verify(token);
    expect(outcome).toEqual({ kind: 'trusted', edition: 'iniciante' });
  });

  it('clamps down when the token under-claims (isitubepro + edition=iniciante → iniciante)', () => {
    const token = makeToken(validClaims({ product_slug: 'isitubepro', edition: 'iniciante' }));
    const outcome = verify(token, { slug: 'isitubepro' });
    expect(outcome).toEqual({ kind: 'trusted', edition: 'iniciante' });
  });

  it('rejects an unknown edition value', () => {
    expectRejected(verify(makeToken(validClaims({ edition: 'enterprise' }))));
  });
});

// --- public API over the embedded key map ---------------------------------

describe('verifyEntitlement — embedded map (public API)', () => {
  it('returns absent with no token', () => {
    expect(
      verifyEntitlement({ token: '', hwid: HWID, slug: 'isitube', nowEpoch: NOW }).kind
    ).toBe('absent');
  });

  it('rejects a token whose kid is not in the embedded map', () => {
    // Signed with our ephemeral key, but the embedded map has no 'test-kid'.
    const outcome = verifyEntitlement({
      token: makeToken(validClaims()),
      hwid: HWID,
      slug: 'isitube',
      nowEpoch: NOW,
    });
    expectRejected(outcome);
    expect(outcome.reason).toMatch(/kid/i);
  });
});

// Sanity: the embedded PROD public key really is the one the panel handed us
// (raw base64url `x` and the SPKI PEM resolve to identical key bytes).
describe('embedded PROD key consistency', () => {
  it('raw base64url x and SPKI PEM are the same key', () => {
    const ED = Buffer.from('302a300506032b6570032100', 'hex');
    const raw = Buffer.from(
      'YoNbolc1ExyQJlXY2opb5RG7qxNLz5yqX45Gt-x0ZjE'.replace(/-/g, '+').replace(/_/g, '/') + '=',
      'base64'
    );
    const fromRaw = createPublicKey(
      `-----BEGIN PUBLIC KEY-----\n${Buffer.concat([ED, raw]).toString('base64')}\n-----END PUBLIC KEY-----`
    )
      .export({ type: 'spki', format: 'der' })
      .toString('hex');
    const fromPem = createPublicKey(
      `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAYoNbolc1ExyQJlXY2opb5RG7qxNLz5yqX45Gt+x0ZjE=
-----END PUBLIC KEY-----`
    )
      .export({ type: 'spki', format: 'der' })
      .toString('hex');
    expect(fromRaw).toBe(fromPem);
  });
});
