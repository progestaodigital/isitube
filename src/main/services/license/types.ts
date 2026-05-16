import type { LicenseInfo } from '@shared/types';

export interface LicenseProvider {
  readonly name: string;

  /**
   * Get the current license state. When `forceRefresh` is true, always hits
   * the panel; otherwise uses the local cache as long as it's fresh enough
   * (provider-specific staleness threshold) and falls back to cache+grace
   * during network failures.
   */
  check(forceRefresh?: boolean): Promise<LicenseInfo>;

  /**
   * User pasted a license key. Validates it against the panel using two-slug
   * discovery and persists the result. Returns the resulting LicenseInfo —
   * `valid` on success, the appropriate status on each failure mode.
   */
  setKey(licenseKey: string): Promise<LicenseInfo>;

  /**
   * Remove the active license from local storage. After this, `check()` will
   * return `status: 'no_key'`. Used by "trocar chave" / log-out flows.
   */
  clear(): Promise<void>;
}
