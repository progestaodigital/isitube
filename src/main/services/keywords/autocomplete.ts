// Real YouTube autocomplete via o mesmo endpoint público que o YouTube usa
// no próprio search box. Não exige chave de API. Quando o endpoint cai
// (rate limit / anti-bot / mudança de protocolo), volta pro fallback de
// sufixos hardcoded — UX sobrevive sem sugestões "vivas".
//
// Endpoint: https://suggestqueries.google.com/complete/search
//   client=firefox  → resposta JSON puro: ["query", ["sug1", "sug2", ...]]
//   ds=yt           → dataset YouTube (sem isso ele sugere termos do Google geral)
//   hl=pt-BR        → idioma de display
//   gl=br           → geo Brasil (afeta ranking)
//
// Fonte do endpoint: domínio de uso interno do YouTube; não documentado, mas
// estável há vários anos. Se quebrar, basta restaurar pro mock sem outras
// mudanças.

const REAL_URL = 'https://suggestqueries.google.com/complete/search';
const FETCH_TIMEOUT_MS = 1500;
const MAX_SUGGESTIONS = 8;

// Fallback determinístico — gera sufixos plausíveis quando o endpoint real
// falha. Suficiente pra a UX continuar utilizável durante interrupções.
const FALLBACK_SUFFIXES = [
  'para iniciantes',
  'em 2026',
  'do zero',
  'avançado',
  'completo',
  'rápido',
  'grátis',
  'tutorial',
  'curso',
  'passo a passo',
];

export async function autocomplete(prefix: string): Promise<string[]> {
  const trimmed = prefix.trim();
  if (trimmed.length < 2) return [];

  try {
    const real = await fetchRealAutocomplete(trimmed);
    if (real.length > 0) return real;
  } catch {
    // qualquer erro → cai pro fallback silenciosamente
  }

  return FALLBACK_SUFFIXES.slice(0, 6).map((s) => `${trimmed} ${s}`);
}

async function fetchRealAutocomplete(query: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = new URL(REAL_URL);
    url.searchParams.set('client', 'firefox');
    url.searchParams.set('ds', 'yt');
    url.searchParams.set('hl', 'pt-BR');
    url.searchParams.set('gl', 'br');
    url.searchParams.set('q', query);

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as unknown;

    // Esperado: ["query", ["sug1", "sug2", ...]]
    if (!Array.isArray(json) || json.length < 2) return [];
    const list = json[1];
    if (!Array.isArray(list)) return [];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of list) {
      if (typeof item !== 'string') continue;
      const cleaned = item.trim();
      if (!cleaned || seen.has(cleaned)) continue;
      seen.add(cleaned);
      out.push(cleaned);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}
