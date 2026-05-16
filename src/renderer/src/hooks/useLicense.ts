// Centraliza o estado de licença no renderer. Componentes (LicenseGateModal,
// LicenseSection, Header, SettingsPage) consomem daqui ao invés de chamar
// `window.api.license.*` direto, pra que uma mudança em um lugar (ex: usuário
// cola chave nova) reflita em todos.
//
// Implementação simples sem store global — cada componente que usa o hook
// gerencia o próprio fetch. Pra mantê-los em sincronia, expomos eventos no
// `window` (`license:changed`) que cada hook escuta. Mais simples que adicionar
// uma store dedicada pra um único subsistema.

import { useCallback, useEffect, useState } from 'react';
import type { LicenseInfo } from '@shared/types';

const LICENSE_CHANGED_EVENT = 'isitube:license-changed';

function broadcastLicenseChanged(info: LicenseInfo): void {
  window.dispatchEvent(new CustomEvent(LICENSE_CHANGED_EVENT, { detail: info }));
}

export function useLicense() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const next = await window.api.license.get(force);
      setInfo(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  const setKey = useCallback(async (key: string): Promise<LicenseInfo> => {
    setSubmitting(true);
    try {
      const next = await window.api.license.set(key);
      setInfo(next);
      broadcastLicenseChanged(next);
      return next;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const clear = useCallback(async () => {
    setSubmitting(true);
    try {
      await window.api.license.clear();
      const next = await window.api.license.get(false);
      setInfo(next);
      broadcastLicenseChanged(next);
      return next;
    } finally {
      setSubmitting(false);
    }
  }, []);

  // Initial fetch + re-fetch on tab focus (catches license changes from
  // background revalidation after the user comes back to the app after a
  // long pause).
  useEffect(() => {
    let cancelled = false;
    window.api.license.get(false).then((next) => {
      if (!cancelled) {
        setInfo(next);
        setLoading(false);
      }
    });

    function onFocus() {
      window.api.license.get(false).then((next) => {
        if (!cancelled) setInfo(next);
      });
    }
    window.addEventListener('focus', onFocus);

    function onChanged(e: Event) {
      const next = (e as CustomEvent<LicenseInfo>).detail;
      if (!cancelled) setInfo(next);
    }
    window.addEventListener(LICENSE_CHANGED_EVENT, onChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(LICENSE_CHANGED_EVENT, onChanged);
    };
  }, []);

  return { info, loading, submitting, refresh, setKey, clear };
}
