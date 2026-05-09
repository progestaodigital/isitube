import type { LicenseInfo } from '@shared/types';

export interface LicenseProvider {
  readonly name: string;

  /**
   * Check the current license status. Real implementations (the IsiPanel
   * provider, planned for after this MVP) will hit a remote endpoint and may
   * cache the result with offline tolerance. The stub returns "valid" forever.
   */
  check(): Promise<LicenseInfo>;
}
