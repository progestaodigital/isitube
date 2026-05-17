import { autocomplete } from './autocomplete';
import { GoogleTrendsRealProvider } from './providers/trends-real';
import type { FreeIdeaSource, FreeKeywordIdea, FreeKeywordIdeasResult } from '@shared/types';

const MODIFIER_PREFIXES = [
  'como',
  'o que é',
  'melhor',
  'tutorial',
  'curso de',
];

// Free ideas usa Trends real. Quando o endpoint do Trends rate-limita (429),
// o catch em volta da chamada engole o erro e segue só com autocomplete —
// "best-effort" mantém o comportamento.
const trendsProvider = new GoogleTrendsRealProvider();

/**
 * Free (no-AI) keyword idea generator. Combines:
 *   1. YouTube autocomplete for the seed itself
 *   2. YouTube autocomplete for several "intent prefixes" (`como`, `melhor`,
 *      `tutorial`, ...) — pulls more variety than just suffix completions
 *   3. Google Trends "rising queries" (best-effort; ignored if unavailable)
 *
 * No API key required, no AI tokens spent. Useful as a default for users
 * who haven't configured an Anthropic key yet, or who just want a quick
 * brainstorm without paying per call.
 */
export async function generateFreeIdeas(seed: string): Promise<FreeKeywordIdeasResult> {
  const startedAt = Date.now();
  const trimmed = seed.trim().toLowerCase();
  if (trimmed.length === 0) {
    return { ideas: [], meta: { durationMs: 0, sources: [] } };
  }

  // Autocomplete for seed + each modifier prefix in parallel.
  const queries = [trimmed, ...MODIFIER_PREFIXES.map((m) => `${m} ${trimmed}`)];
  const acResults = await Promise.allSettled(queries.map((q) => autocomplete(q)));

  const seen = new Set<string>();
  const ideas: FreeKeywordIdea[] = [];
  const sourcesUsed: FreeIdeaSource[] = [];
  let autocompleteHit = false;

  for (const settled of acResults) {
    if (settled.status !== 'fulfilled') continue;
    autocompleteHit = true;
    for (const term of settled.value) {
      const normalized = term.trim().toLowerCase();
      if (!normalized || normalized === trimmed || seen.has(normalized)) continue;
      seen.add(normalized);
      ideas.push({ term: term.trim(), source: 'autocomplete' });
    }
  }
  if (autocompleteHit) sourcesUsed.push('autocomplete');

  // Best-effort: pull Trends rising queries.
  try {
    const trendsResult = await trendsProvider.fetch(trimmed);
    if (trendsResult.risingQueries.length > 0) sourcesUsed.push('trends');
    for (const q of trendsResult.risingQueries) {
      const normalized = q.trim().toLowerCase();
      if (!normalized || normalized === trimmed || seen.has(normalized)) continue;
      seen.add(normalized);
      ideas.push({ term: q.trim(), source: 'trends' });
    }
  } catch {
    // ignore — Trends is best-effort here
  }

  return {
    ideas: ideas.slice(0, 25),
    meta: {
      durationMs: Date.now() - startedAt,
      sources: sourcesUsed,
    },
  };
}
