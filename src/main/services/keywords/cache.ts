import { getPrisma } from '../../db';
import type { KeywordResult } from '@shared/types';
import { calculateScore } from './score';
import type { SourceEnabledMap } from './enricher';

const DEFAULT_TTL_MINUTES = 30;

export async function findFreshCachedSearch(
  term: string,
  enabled: SourceEnabledMap,
  ttlMinutes = DEFAULT_TTL_MINUTES
): Promise<KeywordResult | null> {
  const keyword = await getPrisma().keyword.findUnique({
    where: { term },
    include: {
      searches: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!keyword || keyword.searches.length === 0) return null;

  const latest = keyword.searches[0]!;
  const ageMinutes = (Date.now() - latest.createdAt.getTime()) / (1000 * 60);
  if (ageMinutes > ttlMinutes) return null;

  let parsed: KeywordResult;
  try {
    parsed = JSON.parse(latest.result) as KeywordResult;
  } catch (err) {
    console.error('[keywords/cache] Failed to parse cached result:', err);
    return null;
  }

  // If any source the user currently has enabled is missing from the cached
  // result, invalidate the cache so the caller re-fetches with the full set.
  if (!isCacheCoveringEnabledSources(parsed, enabled)) return null;

  // Apply current toggle state on top of cached data: any source the user has
  // turned OFF gets masked as 'disabled' and the score is recomputed live, so
  // the displayed score always reflects the current source configuration even
  // when serving from cache.
  const adjusted = applyEnabledMask(parsed, enabled);
  return { ...adjusted, cachedFromSearch: true };
}

function isCacheCoveringEnabledSources(
  parsed: KeywordResult,
  enabled: SourceEnabledMap
): boolean {
  if (enabled.scraping && !parsed.scraping.data) return false;
  if (enabled.keywordsEverywhere && !parsed.keywordsEverywhere.data) return false;
  if (enabled.trends && !parsed.trends.data) return false;
  return true;
}

function applyEnabledMask(
  result: KeywordResult,
  enabled: SourceEnabledMap
): KeywordResult {
  const masked: KeywordResult = JSON.parse(JSON.stringify(result));

  if (!enabled.scraping) {
    masked.scraping = disabledFrom(masked.scraping);
  }
  if (!enabled.keywordsEverywhere) {
    masked.keywordsEverywhere = disabledFrom(masked.keywordsEverywhere);
  }
  if (!enabled.trends) {
    masked.trends = disabledFrom(masked.trends);
  }

  masked.score = calculateScore(masked);
  return masked;
}

function disabledFrom<T>(source: KeywordResult['scraping']): KeywordResult['scraping'];
function disabledFrom<T>(source: KeywordResult['keywordsEverywhere']): KeywordResult['keywordsEverywhere'];
function disabledFrom<T>(source: KeywordResult['trends']): KeywordResult['trends'];
function disabledFrom(source: any): any {
  return {
    ...source,
    status: 'disabled',
    data: null,
    errorMessage: 'Desativado nas configurações.',
  };
}

export async function persistSearch(result: KeywordResult): Promise<void> {
  const prisma = getPrisma();

  const keyword = await prisma.keyword.upsert({
    where: { term: result.term },
    update: {
      lastSearchedAt: new Date(result.searchedAt),
      searchCount: { increment: 1 },
    },
    create: {
      term: result.term,
      lastSearchedAt: new Date(result.searchedAt),
      searchCount: 1,
    },
  });

  await prisma.keywordSearch.create({
    data: {
      id: result.id,
      keywordId: keyword.id,
      result: JSON.stringify(result),
      scoreValue: result.score.value,
    },
  });
}
