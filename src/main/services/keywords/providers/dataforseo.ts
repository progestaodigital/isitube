import type { KeywordsEverywhereData, MonthlySearch, RelatedKeyword } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

// keyword_overview (Labs): banco de keywords deles com dificuldade real
// (keyword_difficulty), volume clickstream (melhor cobertura long-tail) e volume
// Google Ads + sazonalidade (monthly_searches) num só request. Quando o termo não
// existe no banco dos Labs, caímos no google_ads/search_volume (comprovado). Se
// nem lá tem volume, o termo é nicho demais: lançamos erro pra fonte cair como
// indisponível e o score renormalizar (scraping + trends).
const OVERVIEW_ENDPOINT =
  'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live';
const GOOGLE_ADS_ENDPOINT =
  'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';
const IDEAS_ENDPOINT = 'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live';

const LOCATION_CODE = 2076; // Brasil
const LANGUAGE_CODE = 'pt';

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Normaliza monthly_searches da DataForSEO ({year, month, search_volume}) pros
 *  últimos 12 meses em ordem cronológica. */
function normalizeMonthly(raw: unknown): MonthlySearch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m) =>
        m &&
        typeof m.year === 'number' &&
        typeof m.month === 'number' &&
        typeof m.search_volume === 'number'
    )
    .map((m) => ({ year: m.year, month: m.month, searchVolume: m.search_volume }))
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .slice(-12);
}

/**
 * Provider de volume/dificuldade via DataForSEO. Ocupa o mesmo slot do Keywords
 * Everywhere (`source: 'keywords_everywhere'`) devolvendo a mesma forma de dado
 * — drop-in, sem tocar no enricher/score. Auth Basic (login:senha).
 */
export class DataForSEOProvider implements KeywordSourceProvider<KeywordsEverywhereData> {
  readonly source = 'keywords_everywhere' as const;
  readonly name = 'DataForSEO';

  constructor(
    private readonly login: string,
    private readonly password: string
  ) {}

  private get authHeader(): string {
    const auth = Buffer.from(`${this.login}:${this.password}`).toString('base64');
    return `Basic ${auth}`;
  }

  /** POST + checagem de status do topo (transporte/auth) e da task (consulta). */
  private async runTask(endpoint: string, body: unknown): Promise<any> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json?.status_code !== 20000) {
      throw new Error(json?.status_message ?? `DataForSEO erro ${res.status}`);
    }
    const task = json?.tasks?.[0];
    if (!task || task.status_code !== 20000) {
      throw new Error(
        task?.status_message
          ? `DataForSEO: ${task.status_message}`
          : 'DataForSEO: task sem resultado.'
      );
    }
    return task;
  }

  private queryOverview(term: string, includeClickstream: boolean): Promise<any> {
    return this.runTask(OVERVIEW_ENDPOINT, [
      {
        keywords: [term],
        location_code: LOCATION_CODE,
        language_code: LANGUAGE_CODE,
        ...(includeClickstream ? { include_clickstream_data: true } : {}),
      },
    ]);
  }

  async fetch(term: string): Promise<KeywordsEverywhereData> {
    try {
      const data = await this.doFetch(term);
      recordSuccess('dataforseo');
      return data;
    } catch (err) {
      recordFailure('dataforseo', err);
      throw err;
    }
  }

  private async doFetch(term: string): Promise<KeywordsEverywhereData> {
    let task: any;
    try {
      task = await this.queryOverview(term, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Conta sem add-on de clickstream: refaz sem o flag (ainda pega volume,
      // dificuldade e sazonalidade).
      if (/clickstream/i.test(msg)) {
        task = await this.queryOverview(term, false);
      } else {
        throw err;
      }
    }

    const item = task?.result?.[0]?.items?.[0];
    if (item) return this.fromOverviewItem(item);

    // keyword_overview não tem o termo no banco dos Labs → Google Ads.
    return this.fetchFromGoogleAds(term);
  }

  private fromOverviewItem(item: any): KeywordsEverywhereData {
    const ki = item.keyword_info ?? {};
    const cs = item.clickstream_keyword_info ?? {};
    const kp = item.keyword_properties ?? {};

    const gAds = typeof ki.search_volume === 'number' ? ki.search_volume : null;
    const clickstreamVolume = typeof cs.search_volume === 'number' ? cs.search_volume : null;
    const volume = gAds ?? clickstreamVolume;
    if (volume === null) {
      throw new Error('Sem dados de volume pra esse termo.');
    }

    const cpc = typeof ki.cpc === 'number' ? ki.cpc : 0;

    // Dificuldade: keyword_difficulty (0-100, real) é o melhor; senão deriva da
    // competition do Google Ads (0-1).
    let difficultyScore = 0;
    if (typeof kp.keyword_difficulty === 'number') {
      difficultyScore = Math.round(kp.keyword_difficulty);
    } else if (typeof ki.competition === 'number') {
      difficultyScore = Math.round(clamp01(ki.competition) * 100);
    }

    const monthlySearches = normalizeMonthly(ki.monthly_searches ?? cs.monthly_searches);
    return { volume, cpc, difficultyScore, clickstreamVolume, monthlySearches };
  }

  private async fetchFromGoogleAds(term: string): Promise<KeywordsEverywhereData> {
    const task = await this.runTask(GOOGLE_ADS_ENDPOINT, [
      { keywords: [term], location_code: LOCATION_CODE, language_code: LANGUAGE_CODE },
    ]);
    const r0 = task.result?.[0];
    // search_volume null = Google Ads não tem dados desse termo (nicho demais).
    if (!r0 || typeof r0.search_volume !== 'number') {
      throw new Error('Sem dados de volume pra esse termo (muito específico/nicho).');
    }

    const volume = r0.search_volume;
    const cpc = typeof r0.cpc === 'number' ? r0.cpc : 0;
    let difficultyScore = 0;
    if (typeof r0.competition_index === 'number') {
      difficultyScore = Math.round(r0.competition_index);
    } else if (typeof r0.competition === 'number') {
      difficultyScore = Math.round(clamp01(r0.competition) * 100);
    }

    const monthlySearches = normalizeMonthly(r0.monthly_searches);
    return { volume, cpc, difficultyScore, clickstreamVolume: null, monthlySearches };
  }

  /** Ideias de palavras-chave relacionadas (mesma categoria/produtos do termo),
   *  ordenadas por volume. Chamada paga separada — usada on-demand. */
  async getIdeas(term: string): Promise<RelatedKeyword[]> {
    try {
      const task = await this.runTask(IDEAS_ENDPOINT, [
        {
          keywords: [term],
          location_code: LOCATION_CODE,
          language_code: LANGUAGE_CODE,
          limit: 25,
          order_by: ['keyword_info.search_volume,desc'],
        },
      ]);
      recordSuccess('dataforseo');
      const items: any[] = task.result?.[0]?.items ?? [];
      const lower = term.toLowerCase();
      return items
        .map((it) => {
          const ki = it.keyword_info ?? {};
          const kp = it.keyword_properties ?? {};
          let difficultyScore: number | null = null;
          if (typeof kp.keyword_difficulty === 'number') {
            difficultyScore = Math.round(kp.keyword_difficulty);
          } else if (typeof ki.competition_index === 'number') {
            difficultyScore = Math.round(ki.competition_index);
          }
          return {
            keyword: typeof it.keyword === 'string' ? it.keyword : '',
            volume: typeof ki.search_volume === 'number' ? ki.search_volume : null,
            cpc: typeof ki.cpc === 'number' ? ki.cpc : null,
            difficultyScore,
          };
        })
        .filter((k) => k.keyword && k.keyword.toLowerCase() !== lower);
    } catch (err) {
      recordFailure('dataforseo', err);
      throw err;
    }
  }
}
