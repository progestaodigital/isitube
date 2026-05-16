// Hook que mantém um snapshot recente das cotas de proxy (Anthropic + YouTube)
// pra renderizar barras de uso na LicenseSection. Faz polling cada 30s
// enquanto montado, e refetch on-focus pra atualização quando o usuário volta
// pra aba após uso intenso.
//
// Os snapshots só existem após o cliente fazer pelo menos uma chamada via
// proxy. Antes disso, `window.api.quota.list()` retorna [].

import { useEffect, useState } from 'react';
import type { QuotaSnapshot } from '@shared/types';

const POLL_INTERVAL_MS = 30_000;

export function useQuota() {
  const [snapshots, setSnapshots] = useState<QuotaSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const next = await window.api.quota.list();
        if (!cancelled) {
          setSnapshots(next);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOnce();
    const interval = setInterval(fetchOnce, POLL_INTERVAL_MS);

    function onFocus() {
      fetchOnce();
    }
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const anthropic = snapshots.find((s) => s.api === 'anthropic') ?? null;
  const youtube = snapshots.find((s) => s.api === 'youtube') ?? null;

  return { anthropic, youtube, loading };
}
