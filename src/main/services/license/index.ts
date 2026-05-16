import type { LicenseInfo } from '@shared/types';
import { IsiPanelLicenseProvider } from './isipanel';
import { loadStoredLicense } from './storage';
import type { LicenseProvider } from './types';

const provider: LicenseProvider = new IsiPanelLicenseProvider();

// In-memory cache so the renderer hitting `license:get` repeatedly doesn't
// pay the storage/decryption + soft-cache check cost each time. The provider
// itself also has a 1h soft cache against the server; this is just memo.
const CACHE_TTL_MS = 60 * 1000; // 1 minute — UI calls this often
let cached: { info: LicenseInfo; at: number } | undefined;

export async function getLicense(forceRefresh = false): Promise<LicenseInfo> {
  if (!forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.info;
  }
  const info = await provider.check(forceRefresh);
  cached = { info, at: Date.now() };
  return info;
}

export async function setLicenseKey(licenseKey: string): Promise<LicenseInfo> {
  const info = await provider.setKey(licenseKey);
  cached = { info, at: Date.now() };
  return info;
}

export async function clearLicense(): Promise<void> {
  await provider.clear();
  cached = undefined;
}

export function resetLicenseCache(): void {
  cached = undefined;
}

/**
 * Convenience: returns the active license plan, or null when there's no
 * valid license. Service selectors (ai, channels, videos, keywords) call
 * this to route between proxy mode (iniciante) and direct/BYOK (pro).
 */
export async function getActivePlan(): Promise<'iniciante' | 'pro' | null> {
  const info = await getLicense(false);
  if (!info.valid) return null;
  return info.plan;
}

/**
 * Internal-only: returns the plaintext license key for selector code that
 * needs to construct a ProxyConfig (Plano Iniciante path). MUST NEVER be
 * exposed via IPC — the renderer never sees the license key after the user
 * pastes it in the gate modal. Returns null when there's no stored license
 * or when decryption fails (DB transplanted to a different Windows user).
 */
export async function getActiveLicenseKey(): Promise<string | null> {
  const stored = await loadStoredLicense();
  return stored?.licenseKey ?? null;
}
