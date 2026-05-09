import type {
  KeywordResult,
  ScrapingData,
  KeywordsEverywhereData,
  TrendsData,
  SourceResult,
  KeywordSource,
  SourceStatus,
} from '@shared/types';
import type { KeywordSourceProvider } from './providers/types';
import { calculateScore } from './score';
import { randomUUID } from 'node:crypto';

export type SourceEnabledMap = {
  scraping: boolean;
  keywordsEverywhere: boolean;
  trends: boolean;
};

export type Providers = {
  scraping: KeywordSourceProvider<ScrapingData>;
  keywordsEverywhere: KeywordSourceProvider<KeywordsEverywhereData>;
  trends: KeywordSourceProvider<TrendsData>;
};

/**
 * Orchestrates fetching from all 3 providers in parallel via Promise.allSettled,
 * so a failure in any one source doesn't break the others. Builds the final
 * KeywordResult including the renormalized score. Providers are passed in so
 * the caller can choose between mock and real implementations per request
 * based on credential validity.
 */
export async function enrichKeyword(
  term: string,
  enabled: SourceEnabledMap,
  providers: Providers
): Promise<KeywordResult> {
  const [scrapingResult, keResult, trendsResult] = await Promise.allSettled([
    enabled.scraping
      ? runProvider(providers.scraping, term)
      : disabledResult<ScrapingData>('scraping'),
    enabled.keywordsEverywhere
      ? runProvider(providers.keywordsEverywhere, term)
      : disabledResult<KeywordsEverywhereData>('keywords_everywhere'),
    enabled.trends
      ? runProvider(providers.trends, term)
      : disabledResult<TrendsData>('trends'),
  ]);

  const partial: KeywordResult = {
    id: randomUUID(),
    term,
    searchedAt: new Date().toISOString(),
    cachedFromSearch: false,
    scraping: settledToSourceResult<ScrapingData>('scraping', scrapingResult),
    keywordsEverywhere: settledToSourceResult<KeywordsEverywhereData>(
      'keywords_everywhere',
      keResult
    ),
    trends: settledToSourceResult<TrendsData>('trends', trendsResult),
    // Score filled below.
    score: { value: null, components: [], explanation: '', missingSources: [] },
  };

  partial.score = calculateScore(partial);
  return partial;
}

async function runProvider<T>(
  provider: KeywordSourceProvider<T>,
  term: string
): Promise<SourceResult<T>> {
  const startedAt = Date.now();
  const data = await provider.fetch(term);
  return {
    source: provider.source,
    status: 'ok',
    data,
    errorMessage: null,
    fetchedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}

function disabledResult<T>(source: KeywordSource): Promise<SourceResult<T>> {
  return Promise.resolve({
    source,
    status: 'disabled' as SourceStatus,
    data: null,
    errorMessage: 'Fonte desativada nas configurações.',
    fetchedAt: new Date().toISOString(),
    durationMs: 0,
  });
}

function settledToSourceResult<T>(
  source: KeywordSource,
  settled: PromiseSettledResult<SourceResult<T>>
): SourceResult<T> {
  if (settled.status === 'fulfilled') {
    return settled.value;
  }
  return {
    source,
    status: 'error',
    data: null,
    errorMessage:
      settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
    fetchedAt: new Date().toISOString(),
    durationMs: 0,
  };
}
