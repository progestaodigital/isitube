import { useEffect, useState } from 'react';
import type { CredentialProvider, CredentialStatus } from '@shared/types';

/**
 * Watches the status of one credential. Re-fetches whenever the main process
 * broadcasts that THIS provider's credential changed (set/delete/test).
 *
 * Returns null while loading; the actual status object once loaded.
 */
export function useCredentialStatus(provider: CredentialProvider): CredentialStatus | null {
  const [status, setStatus] = useState<CredentialStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      window.api.credentials.list().then((all) => {
        if (cancelled) return;
        setStatus(all.find((c) => c.provider === provider) ?? null);
      });
    }

    refresh();

    const off = window.api.events.onCredentialsChanged((payload) => {
      if (payload.provider === provider) refresh();
    });

    return () => {
      cancelled = true;
      off();
    };
  }, [provider]);

  return status;
}

export function isCredentialReady(status: CredentialStatus | null): boolean {
  return Boolean(status && status.status === 'valid' && status.hasValue);
}
