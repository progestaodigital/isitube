import { getPrisma } from '../../db';
import { getSetting, setSetting } from '../settings';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import { getActivePlan } from '../license';
import { enrichKeyword, type Providers, type SourceEnabledMap } from './enricher';
import { findFreshCachedSearch, persistSearch } from './cache';
import { autocomplete } from './autocomplete';
// KE mock continua como fallback quando o usuário Pro não tem chave BYOK
// configurada. Scraping e Trends sempre usam os providers reais — os mocks
// originais foram deletados na Fase 10.B (eram dead code).
import { KeywordsEverywhereProvider } from './providers/keywords-everywhere';
import { ScrapingRealProvider } from './providers/scraping-real';
import { KeywordsEverywhereRealProvider } from './providers/keywords-everywhere-real';
import { DataForSEOProvider } from './providers/dataforseo';
import { GoogleTrendsRealProvider } from './providers/trends-real';
import type {
  KeywordHistoryItem,
  KeywordResult,
  KeywordSource,
  KeywordSourceStatuses,
  KeywordSearchOptions,
  RelatedKeywordsResult,
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
  const [statuses, plan] = await Promise.all([getSourceStatuses(), getActivePlan()]);
  // Keywords Everywhere is Pro-BYOK only (no proxy in V1, by panel decision).
  // Force the source disabled on Iniciante regardless of user toggle, so the
  // score recomputes cleanly from scraping + trends only. The UI hides the
  // KE toggle in iniciante to keep the user from being confused by a setting
  // that has no effect.
  const keEnabled = plan === 'iniciante' ? false : statuses.keywordsEverywhere.enabled;
  return {
    scraping: statuses.scraping.enabled,
    keywordsEverywhere: keEnabled,
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
function parseDfsCreds(raw: string): { login: string; password: string } | null {
  try {
    const o = JSON.parse(raw) as { login?: string; password?: string };
    if (o.login && o.password) return { login: o.login, password: o.password };
  } catch {
    /* malformado */
  }
  return null;
}

async function buildProviders(): Promise<Providers> {
  const scraping = new ScrapingRealProvider();
  const trends = new GoogleTrendsRealProvider();

  // Slot de volume/dificuldade: prefere DataForSEO (dado melhor); cai no Keywords
  // Everywhere se só ele estiver configurado; senão, mock (mantém o score vivo).
  let keywordsEverywhere: Providers['keywordsEverywhere'] = new KeywordsEverywhereProvider();

  const dfsStatus = await getCredentialStatus('dataforseo');
  if (dfsStatus?.status === 'valid' && dfsStatus.hasValue) {
    const raw = await getCredentialPlainText('dataforseo');
    const creds = raw ? parseDfsCreds(raw) : null;
    if (creds) keywordsEverywhere = new DataForSEOProvider(creds.login, creds.password);
  } else {
    const keStatus = await getCredentialStatus('keywords_everywhere');
    if (keStatus?.status === 'valid' && keStatus.hasValue) {
      const key = await getCredentialPlainText('keywords_everywhere');
      if (key) keywordsEverywhere = new KeywordsEverywhereRealProvider(key);
    }
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

async function buildDataForSEOProvider(): Promise<DataForSEOProvider> {
  const dfsStatus = await getCredentialStatus('dataforseo');
  if (dfsStatus?.status !== 'valid' || !dfsStatus.hasValue) {
    throw new Error('Configure o DataForSEO nas Configurações pra ver ideias de palavras-chave.');
  }
  const raw = await getCredentialPlainText('dataforseo');
  const creds = raw ? parseDfsCreds(raw) : null;
  if (!creds) {
    throw new Error('Credenciais do DataForSEO inválidas. Reconfigure nas Configurações.');
  }
  return new DataForSEOProvider(creds.login, creds.password);
}

/**
 * Ideias de palavras-chave relacionadas via DataForSEO (volume real). Chamada
 * paga separada — disparada on-demand pela UI, não em toda busca.
 */
export async function getRelatedKeywords(term: string): Promise<RelatedKeywordsResult> {
  const seed = term.trim();
  if (seed.length === 0) throw new Error('Termo vazio.');
  const provider = await buildDataForSEOProvider();
  const items = await provider.getIdeas(seed);
  return { seed, items };
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
