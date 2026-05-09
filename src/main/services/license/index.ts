import type { LicenseInfo } from '@shared/types';
import { StubLicenseProvider } from './stub';
import type { LicenseProvider } from './types';

const provider: LicenseProvider = new StubLicenseProvider();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cached: { info: LicenseInfo; at: number } | undefined;

export async function getLicense(forceRefresh = false): Promise<LicenseInfo> {
  if (!forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.info;
  }
  const info = await provider.check();
  cached = { info, at: Date.now() };
  return info;
}

export function resetLicenseCache(): void {
  cached = undefined;
}
