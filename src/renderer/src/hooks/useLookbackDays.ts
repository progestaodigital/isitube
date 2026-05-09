import { useEffect, useState } from 'react';

const SETTING_KEY = 'channels.lookback_days';
const DEFAULT_LOOKBACK = 30;

/**
 * Reactive read of the current outlier-detection lookback window in days.
 * Falls back to 30 days if the setting hasn't been written. Used by UI labels
 * like "média do canal nos últimos N dias" so the displayed window stays in
 * sync with what's actually being used by the detector.
 */
export function useLookbackDays(): number {
  const [days, setDays] = useState<number>(DEFAULT_LOOKBACK);

  useEffect(() => {
    let cancelled = false;
    window.api.settings.get(SETTING_KEY).then((value) => {
      if (cancelled) return;
      const n = value ? Number(value) : NaN;
      if (Number.isFinite(n) && n > 0) setDays(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return days;
}
