import type { LicenseInfo } from '@shared/types';
import type { LicenseProvider } from './types';

/**
 * Phase 7 stub. Always returns a valid Pro license. Replaced by an
 * `IsiPanelLicenseProvider` once the IsiPanel API is available — the
 * factory in `./index.ts` is the only thing that needs to change.
 */
export class StubLicenseProvider implements LicenseProvider {
  readonly name = 'stub';

  async check(): Promise<LicenseInfo> {
    const now = new Date();
    const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return {
      valid: true,
      plan: 'pro',
      planLabel: 'Pro (BYOK)',
      expiresAt: expires.toISOString(),
      lastValidatedAt: now.toISOString(),
      isStub: true,
      reason: null,
    };
  }
}
