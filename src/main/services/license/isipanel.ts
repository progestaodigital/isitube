// Real license provider — talks to the isipanel `/v1/license/validate`
// endpoint, performs two-slug discovery (tries `isitubepro` first, falls
// back to `isitube`), caches the result via `storage.ts`, and respects the
// server-provided `grace_until` window for offline use.
//
// Server contract documented in CLIENT-HANDOFF.md / PROXY-CONTRACT.md from
// the panel side (Phase 14.5).

import { app } from 'electron';
import type { LicenseInfo, LicensePlan, LicenseStatus } from '@shared/types';
import type { LicenseProvider } from './types';
import { getHwid } from './hwid';
import { verifyEntitlement } from './entitlement';
import {
  clearStoredLicense,
  loadStoredLicense,
  saveStoredLicense,
  type LicensePlanKey,
  type LicenseSlug,
  type StoredLicense,
} from './storage';

const VALIDATE_URL = 'https://api.isitools.com.br/v1/license/validate';

// Order matters: try Pro first so a Pro license short-circuits the discovery
// on first install. Cached slug overrides this priority on subsequent calls.
const SLUGS_PRIORITY: LicenseSlug[] = ['isitubepro', 'isitube'];

// How long a cached "valid" result is trusted before we revalidate against
// the server. Independent of `grace_until` which governs offline tolerance.
const SOFT_CACHE_MS = 60 * 60 * 1000; // 1h

type ValidateRequest = {
  license_key: string;
  hwid: string;
  product_slug: LicenseSlug;
  app_version: string;
};

type ValidatePayload =
  | {
      status: 'valid';
      expires_at: string;
      grace_until: string;
      hwid_bound: boolean;
      subscription_url: string | null;
      support_url: string | null;
      /**
       * OPTIONAL signed entitlement (EdDSA/JWT). Present only on `valid` from a
       * panel new enough to issue it. When present we trust ONLY the signed
       * claims for gating; when absent we keep the legacy JSON-based behavior.
       */
      entitlement?: string;
    }
  | {
      status: 'invalid';
      message: string;
    }
  | {
      status: 'hwid_mismatch';
      message: string;
      subscription_url: string | null;
      support_url: string | null;
    }
  | {
      status: 'expired';
      expires_at: string;
      message: string;
      subscription_url: string | null;
      support_url: string | null;
    }
  | {
      status: 'blocked';
      message: string;
      subscription_url: string | null;
      support_url: string | null;
    };

type NetworkOutcome =
  | { kind: 'ok'; body: ValidatePayload }
  | { kind: 'rate_limited' }
  | { kind: 'network_error' }
  | { kind: 'server_error' };

function planFromSlug(slug: LicenseSlug): LicensePlan {
  return slug === 'isitubepro' ? 'pro' : 'iniciante';
}

function planLabel(plan: LicensePlan): string {
  return plan === 'pro' ? 'isiTube Pro' : 'isiTube';
}

function emptyInfo(reason: string | null = null): LicenseInfo {
  return {
    valid: false,
    status: 'no_key',
    plan: 'pro',
    planLabel: '—',
    slug: null,
    expiresAt: null,
    graceUntil: null,
    subscriptionUrl: null,
    supportUrl: null,
    lastValidatedAt: null,
    isStub: false,
    reason,
  };
}

function infoFromStored(stored: StoredLicense, overrides: Partial<LicenseInfo> = {}): LicenseInfo {
  return {
    valid: true,
    status: 'valid',
    plan: stored.plan,
    planLabel: planLabel(stored.plan),
    slug: stored.slug,
    expiresAt: stored.expiresAt?.toISOString() ?? null,
    graceUntil: stored.graceUntil?.toISOString() ?? null,
    subscriptionUrl: stored.subscriptionUrl,
    supportUrl: stored.supportUrl,
    lastValidatedAt: stored.lastValidatedAt.toISOString(),
    isStub: false,
    reason: null,
    ...overrides,
  };
}

function infoFromError(
  status: LicenseStatus,
  payload: Extract<ValidatePayload, { status: 'hwid_mismatch' | 'expired' | 'blocked' | 'invalid' }>,
  stored: StoredLicense | null
): LicenseInfo {
  const base = stored ? infoFromStored(stored) : emptyInfo();
  return {
    ...base,
    valid: false,
    status,
    reason: payload.message,
    subscriptionUrl: 'subscription_url' in payload ? payload.subscription_url : base.subscriptionUrl,
    supportUrl: 'support_url' in payload ? payload.support_url : base.supportUrl,
    expiresAt:
      'expires_at' in payload && payload.expires_at ? payload.expires_at : base.expiresAt,
  };
}

async function callValidate(input: ValidateRequest): Promise<NetworkOutcome> {
  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (res.status === 429) return { kind: 'rate_limited' };
    if (res.status >= 500) return { kind: 'server_error' };
    if (!res.ok) return { kind: 'server_error' };

    const body = (await res.json()) as ValidatePayload;
    return { kind: 'ok', body };
  } catch {
    return { kind: 'network_error' };
  }
}

function storedFromValid(
  payload: Extract<ValidatePayload, { status: 'valid' }>,
  licenseKey: string,
  hwid: string,
  slug: LicenseSlug,
  // When the signed entitlement is trusted, the plan comes from its `edition`
  // claim instead of being inferred from the slug. Falls back to the slug.
  planOverride?: LicensePlanKey
): StoredLicense {
  return {
    licenseKey,
    hwid,
    slug,
    plan: planOverride ?? planFromSlug(slug),
    expiresAt: payload.expires_at ? new Date(payload.expires_at) : null,
    graceUntil: payload.grace_until ? new Date(payload.grace_until) : null,
    subscriptionUrl: payload.subscription_url,
    supportUrl: payload.support_url,
    lastValidatedAt: new Date(),
    lastResponseJson: JSON.stringify(payload),
  };
}

/**
 * Try the given slugs in order, returning on the first that's not 'invalid'
 * (success OR an error status we should surface). If all slugs return
 * 'invalid', returns the last result (`status: 'invalid'`).
 */
async function discover(
  licenseKey: string,
  hwid: string,
  slugs: LicenseSlug[]
): Promise<{ slug: LicenseSlug; outcome: NetworkOutcome }> {
  let last: { slug: LicenseSlug; outcome: NetworkOutcome } | null = null;
  for (const slug of slugs) {
    const outcome = await callValidate({
      license_key: licenseKey,
      hwid,
      product_slug: slug,
      app_version: app.getVersion(),
    });
    last = { slug, outcome };

    // Stop on first non-invalid response (success or non-discovery error).
    if (outcome.kind !== 'ok') return last;
    if (outcome.body.status !== 'invalid') return last;
  }
  // All invalid — return the last attempt so caller can surface 'invalid'.
  return last!;
}

export class IsiPanelLicenseProvider implements LicenseProvider {
  readonly name = 'isipanel';

  async check(forceRefresh = false): Promise<LicenseInfo> {
    const stored = await loadStoredLicense();
    if (!stored) return emptyInfo();

    // Fast path: recent cache, no force → just return cached.
    const ageMs = Date.now() - stored.lastValidatedAt.getTime();
    if (!forceRefresh && ageMs < SOFT_CACHE_MS) {
      return infoFromStored(stored);
    }

    const hwid = await getHwid();

    // Cached slug first.
    const primary = await callValidate({
      license_key: stored.licenseKey,
      hwid,
      product_slug: stored.slug,
      app_version: app.getVersion(),
    });

    // Network / server / rate limit → fall back to cache + grace window.
    if (primary.kind !== 'ok') {
      const offlineStatus: LicenseStatus =
        primary.kind === 'rate_limited' ? 'rate_limited' : 'network_error';
      return this.fallbackToCache(stored, offlineStatus);
    }

    const body = primary.body;

    if (body.status === 'valid') {
      return this.resolveValid(body, stored.licenseKey, hwid, stored.slug);
    }

    if (body.status === 'invalid') {
      // Cached slug stopped working — maybe user upgraded/downgraded. Try the
      // other slugs in priority order, skipping the one we just tested.
      const otherSlugs = SLUGS_PRIORITY.filter((s) => s !== stored.slug);
      const rediscover = await discover(stored.licenseKey, hwid, otherSlugs);

      if (rediscover.outcome.kind !== 'ok') {
        const offlineStatus: LicenseStatus =
          rediscover.outcome.kind === 'rate_limited' ? 'rate_limited' : 'network_error';
        return this.fallbackToCache(stored, offlineStatus);
      }

      const rediscoverBody = rediscover.outcome.body;
      if (rediscoverBody.status === 'valid') {
        return this.resolveValid(rediscoverBody, stored.licenseKey, hwid, rediscover.slug);
      }

      // Both slugs reject the key → truly invalid. Wipe cache.
      await clearStoredLicense();
      if (rediscoverBody.status === 'invalid') {
        return { ...emptyInfo(), status: 'invalid', reason: rediscoverBody.message };
      }
      // Other statuses (hwid_mismatch/expired/blocked) on the second slug
      // are surfaced as-is — same key, different binding state.
      return infoFromError(rediscoverBody.status, rediscoverBody, null);
    }

    // hwid_mismatch / expired / blocked on the cached slug. Keep the cached
    // license info but mark the error status so UX can act on it.
    return infoFromError(body.status, body, stored);
  }

  async setKey(licenseKey: string): Promise<LicenseInfo> {
    const hwid = await getHwid();
    const { slug, outcome } = await discover(licenseKey, hwid, SLUGS_PRIORITY);

    if (outcome.kind !== 'ok') {
      const status: LicenseStatus =
        outcome.kind === 'rate_limited' ? 'rate_limited' : 'network_error';
      return {
        ...emptyInfo(),
        status,
        reason:
          status === 'rate_limited'
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : 'Sem conexão com o painel. Verifique a internet.',
      };
    }

    const body = outcome.body;

    if (body.status === 'valid') {
      return this.resolveValid(body, licenseKey, hwid, slug);
    }

    if (body.status === 'invalid') {
      return {
        ...emptyInfo(),
        status: 'invalid',
        reason: 'Chave inválida ou não vinculada a este produto.',
      };
    }

    // hwid_mismatch / expired / blocked — chave existe mas não pode ser usada aqui.
    return infoFromError(body.status, body, null);
  }

  async clear(): Promise<void> {
    await clearStoredLicense();
  }

  /**
   * Handle a `valid` validate response. Verifies the optional signed
   * entitlement, then persists and returns the resulting LicenseInfo.
   *
   *  - entitlement ABSENT  → legacy behavior: trust the JSON, plan from slug.
   *  - entitlement TRUSTED → gate off the signed `edition` claim.
   *  - entitlement REJECTED → present but failed crypto/binding: refuse to
   *    grant access (defends against a tampered / MITM'd `valid`). We leave any
   *    existing cache untouched — the real server is fine; this reply is suspect.
   */
  private async resolveValid(
    body: Extract<ValidatePayload, { status: 'valid' }>,
    licenseKey: string,
    hwid: string,
    slug: LicenseSlug
  ): Promise<LicenseInfo> {
    const outcome = verifyEntitlement({
      token: body.entitlement,
      hwid,
      slug,
      nowEpoch: Math.floor(Date.now() / 1000),
    });

    if (outcome.kind === 'rejected') {
      return {
        ...emptyInfo(),
        status: 'invalid',
        reason: 'Não foi possível verificar a assinatura da licença. Tente novamente.',
      };
    }

    const planOverride = outcome.kind === 'trusted' ? outcome.edition : undefined;
    const updated = storedFromValid(body, licenseKey, hwid, slug, planOverride);
    await saveStoredLicense(updated);
    return infoFromStored(updated);
  }

  /**
   * Build an offline-fallback LicenseInfo from the cached license. Within
   * `grace_until` we treat the license as effectively valid (UX may show a
   * subtle offline indicator). After it expires we return `expired_offline`
   * and the gate modal blocks the app.
   */
  private fallbackToCache(stored: StoredLicense, offlineStatus: LicenseStatus): LicenseInfo {
    const now = Date.now();
    const graceMs = stored.graceUntil?.getTime() ?? 0;

    if (graceMs > now) {
      // Within grace — surface as valid; reason field carries a hint.
      return infoFromStored(stored, {
        reason: offlineStatus === 'rate_limited' ? 'Validação limitada — usando cache.' : 'Sem conexão — usando cache.',
      });
    }

    // Outside grace window — block.
    return {
      ...infoFromStored(stored),
      valid: false,
      status: 'expired_offline',
      reason:
        offlineStatus === 'rate_limited'
          ? 'Limite de validação atingido e cache expirado.'
          : 'Sem conexão e cache de validação expirou.',
    };
  }
}
