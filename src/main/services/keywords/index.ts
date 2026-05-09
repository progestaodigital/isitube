import { getPrisma } from '../../db';
import { getSetting, setSetting } from '../settings';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import { enrichKeyword, type Providers, type SourceEnabledMap } from './enricher';
import { findFreshCachedSearch, persistSearch } from './cache';
import { autocomplete } from './autocomplete';
// Mock providers — used as fallback when real providers can't be selected.
import { ScrapingProvider } from './providers/scraping';
import { KeywordsEverywhereProvider } from './providers/keywords-everywhere';
import { TrendsProvider } from './providers/trends';
// Real providers — selected when conditions are met (key valid, etc).
import { ScrapingRealProvider } from './providers/scraping-real';
import { KeywordsEverywhereRealProvider } from './providers/keywords-everywhere-real';
import { GoogleTrendsRealProvider } from './providers/trends-real';
import type {
  KeywordHistoryItem,
  KeywordResult,
  KeywordSource,
  KeywordSourceStatuses,
  KeywordSearchOptions,
} from '@shared/types';

const SETTING_KEYS = {
  scraping: 'keywords.source.scraping.enabled',
  keywordsEverywhere: 'keywords.source.keywords_everywhere.enabled',
  trends: 'keywords.source.trends.enabled',
} as const;

async function readEnabled(key: string, fallback = true): Promise<boolean> {
  const value = await getSetting(key);
  if (value === null) return fallback;
  return value === 'true';
}

export async function getSourceStatuses(): Promise<KeywordSourceStatuses> {
  const [scraping, keywordsEverywhere, trends] = await Promise.all([
    readEnabled(SETTING_KEYS.scraping),
    readEnabled(SETTING_KEYS.keywordsEverywhere),
    readEnabled(SETTING_KEYS.trends),
  ]);
  return {
    scraping: { enabled: scraping },
    keywordsEverywhere: { enabled: keywordsEverywhere },
    trends: { enabled: trends },
  };
}

export async function setSourceEnabled(
  source: KeywordSource,
  enabled: boolean
): Promise<void> {
  const key =
    source === 'scraping'
      ? SETTING_KEYS.scraping
      : source === 'keywords_everywhere'
        ? SETTING_KEYS.keywordsEverywhere
        : SETTING_KEYS.trends;
  await setSetting(key, enabled ? 'true' : 'false');
}

async function buildSourceEnabledMap(): Promise<SourceEnabledMap> {
  const statuses = await getSourceStatuses();
  return {
    scraping: statuses.scraping.enabled,
    keywordsEverywhere: statuses.keywordsEverywhere.enabled,
    trends: statuses.trends.enabled,
  };
}

/**
 * Per-request provider selection:
 *   - Scraping:  always real (no key needed; @distube/ytsr scrapes YouTube)
 *   - Trends:    always real (no key needed; google-trends-api)
 *   - Keywords Everywhere: real only when the user has a valid key cadastrated;
 *                          falls back to mock otherwise so the rest of the
 *                          score still works
 */
async function buildProviders(): Promise<Providers> {
  const scraping = new ScrapingRealProvider();
  const trends = new GoogleTrendsRealProvider();

  const keStatus = await getCredentialStatus('keywords_everywhere');
  let keywordsEverywhere: Providers['keywordsEverywhere'] = new KeywordsEverywhereProvider();
  if (keStatus?.status === 'valid' && keStatus.hasValue) {
    const key = await getCredentialPlainText('keywords_everywhere');
    if (key) keywordsEverywhere = new KeywordsEverywhereRealProvider(key);
  }

  return { scraping, keywordsEverywhere, trends };
}

export async function searchKeyword(
  term: string,
  options: KeywordSearchOptions = {}
): Promise<KeywordResult> {
  const normalized = term.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error('Termo vazio.');
  }

  const enabled = await buildSourceEnabledMap();

  if (!options.forceRefresh) {
    // Cache lookup is source-aware: if any currently-enabled source isn't
    // present in the cached snapshot, we treat it as a miss and re-fetch.
    // Sources currently disabled get masked off the cached data and the
    // score is recomputed, so the displayed score always matches the current
    // source configuration even on cache hits.
    const cached = await findFreshCachedSearch(normalized, enabled);
    if (cached) return cached;
  }

  const providers = await buildProviders();
  const result = await enrichKeyword(normalized, enabled, providers);
  await persistSearch(result);
  return result;
}

export async function listHistory(limit = 20): Promise<KeywordHistoryItem[]> {
  const prisma = getPrisma();
  const keywords = await prisma.keyword.findMany({
    where: { deletedAt: null },
    orderBy: { lastSearchedAt: 'desc' },
    take: limit,
    include: {
      searches: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return keywords.flatMap((kw) => {
    const latest = kw.searches[0];
    if (!latest) return [];
    return [
      {
        id: latest.id,
        term: kw.term,
        searchedAt: latest.createdAt.toISOString(),
        scoreValue: latest.scoreValue,
      },
    ];
  });
}

export { autocomplete };

// Used internally by free-ideas.ts so it can mirror our mock/real selection.
void ScrapingProvider;
void TrendsProvider;
