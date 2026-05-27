import ytsr from '@distube/ytsr';
import type { ScrapingData, TopResult } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

/**
 * Real "scraping" provider — uses @distube/ytsr to fetch the YouTube search
 * results page. ytsr extracts the data from the initial JSON payload that
 * YouTube embeds in the HTML, so we don't need a headless browser.
 *
 * Risks (documented for future maintenance):
 *   - YouTube can change the HTML/JSON structure → ytsr breaks
 *   - Heavy use can trigger anti-bot rate limiting (HTTP 429)
 *   - View counts and publish dates are scraped strings, may be approximate
 */
export class ScrapingRealProvider implements KeywordSourceProvider<ScrapingData> {
  readonly source = 'scraping' as const;
  readonly name = 'Scraping próprio';

  async fetch(term: string): Promise<ScrapingData> {
    let result;
    try {
      result = await ytsr(term, {
        gl: 'BR',
        hl: 'pt',
        type: 'video',
        safeSearch: false,
      });
      recordSuccess('youtube-scraping');
    } catch (err) {
      recordFailure('youtube-scraping', err);
      throw err;
    }

    const items = (result.items ?? []).slice(0, 10);
    if (items.length === 0) {
      throw new Error('Nenhum resultado retornado pela busca do YouTube.');
    }

    const topResults: TopResult[] = items.map((item: any, i: number) => ({
      position: i + 1,
      title: typeof item.name === 'string' ? item.name : '',
      channelName:
        typeof item.author?.name === 'string' ? item.author.name : '',
      viewCount: parseViewCount(item.views),
      publishedAt: parseUploadedAt(item.uploadedAt),
      videoId: extractVideoId(item),
    }));

    const ages = topResults.map((r) => daysSince(r.publishedAt));
    const averageAgeDays = average(ages);
    const highViewCountInTop = topResults.filter((r) => r.viewCount > 500_000).length;
    const averageViewsTop = average(topResults.map((r) => r.viewCount));

    // competitionScore combina três sinais — views absolutas (entrenchment),
    // velocidade (views/dia, captura termos em alta) e recência (% do top
    // publicado nos últimos 90 dias, captura competição ativa). A versão
    // anterior só olhava views absolutas e subestimava drasticamente termos
    // recém-explodindo (ex: "claude code" dava ~14 sendo claramente quente).
    const viewsPerDay = topResults.map((r) => r.viewCount / Math.max(1, daysSince(r.publishedAt)));
    const medianViewsPerDay = median(viewsPerDay);
    const recentCount = topResults.filter((r) => daysSince(r.publishedAt) <= 90).length;

    const sigViews = (highViewCountInTop / 10) * 100;
    const sigVelocity = normalizeVelocity(medianViewsPerDay);
    const sigRecency = (recentCount / topResults.length) * 100;

    const competitionScore = clamp(
      sigViews * 0.35 + sigVelocity * 0.40 + sigRecency * 0.25,
      0,
      100,
    );

    return {
      topResults,
      averageAgeDays,
      highViewCountInTop,
      averageViewsTop,
      competitionScore,
    };
  }
}

/** Views/dia → 0-100 em escala log: 100/dia → 0, 10k/dia → 100. */
function normalizeVelocity(viewsPerDay: number): number {
  if (viewsPerDay <= 0) return 0;
  const log = Math.log10(viewsPerDay);
  return clamp(((log - 2) / 2) * 100, 0, 100);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function extractVideoId(item: any): string | null {
  // ytsr exposes both `id` and `url`. Prefer the explicit id, fall back to
  // parsing it out of the watch URL (handles ?v= and youtu.be/ shortlinks).
  if (typeof item?.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(item.id)) {
    return item.id;
  }
  if (typeof item?.url === 'string') {
    const m = item.url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

function parseViewCount(value: unknown): number {
  if (typeof value === 'number') return Math.max(0, Math.round(value));
  if (typeof value === 'string') {
    const n = parseInt(value.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * ytsr returns relative date strings like "3 days ago", "2 weeks ago" in the
 * page's locale. We try a few patterns; if nothing matches, we assume it's
 * recent (60 days back as a placeholder).
 */
function parseUploadedAt(value: unknown): string {
  if (typeof value !== 'string') {
    return new Date(Date.now() - 60 * 86_400_000).toISOString();
  }
  const lower = value.toLowerCase();
  const m = lower.match(/(\d+)\s*(hora|dia|semana|m[eê]s|ano|hour|day|week|month|year)/);
  if (m) {
    const n = parseInt(m[1]!, 10);
    const unit = m[2]!;
    let days = 0;
    if (/hora|hour/.test(unit)) days = n / 24;
    else if (/dia|day/.test(unit)) days = n;
    else if (/semana|week/.test(unit)) days = n * 7;
    else if (/m[eê]s|month/.test(unit)) days = n * 30;
    else if (/ano|year/.test(unit)) days = n * 365;
    return new Date(Date.now() - days * 86_400_000).toISOString();
  }
  return new Date(Date.now() - 60 * 86_400_000).toISOString();
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
