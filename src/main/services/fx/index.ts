import { getSetting, setSetting } from '../settings';

// Cotação USD→BRL pra exibir custos (ex: geração de thumbnail) em real.
// Cache em memória de 6h + persistência do último valor pra funcionar offline.
// Endpoint público brasileiro (AwesomeAPI), sem chave.

const TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_RATE = 5.2;
const SETTING_KEY = 'fx.usd_brl';
const ENDPOINT = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';

let cache: { rate: number; at: number } | null = null;

export async function getUsdBrlRate(): Promise<number> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rate;

  try {
    const res = await fetch(ENDPOINT);
    if (res.ok) {
      const json = (await res.json()) as { USDBRL?: { bid?: string } };
      const rate = parseFloat(json?.USDBRL?.bid ?? '');
      if (Number.isFinite(rate) && rate > 0) {
        cache = { rate, at: Date.now() };
        await setSetting(SETTING_KEY, String(rate));
        return rate;
      }
    }
  } catch {
    /* API fora do ar / sem internet — cai no fallback abaixo */
  }

  // Fallback: último valor conhecido (persistido) ou um default razoável.
  const persisted = parseFloat((await getSetting(SETTING_KEY)) ?? '');
  const rate = Number.isFinite(persisted) && persisted > 0 ? persisted : DEFAULT_RATE;
  cache = { rate, at: Date.now() };
  return rate;
}
