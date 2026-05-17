import googleTrends from 'google-trends-api';
import type { TrendsData, TrendsTimeSeriesPoint } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

/**
 * Real Google Trends provider — uses the unofficial google-trends-api npm
 * package which scrapes the public Trends endpoints. No API key required.
 *
 * Trends has aggressive rate limiting (~quota of ~ 1 req/sec, hard 429 if
 * exceeded). We swallow 429s as "unavailable" so the keyword score keeps
 * computing with the other sources.
 *
 * **Cooldown** (10.C): após qualquer falha que cheire a rate limit,
 * suspendemos chamadas por COOLDOWN_AFTER_429_MS minutos. Bater de novo
 * com 429 só piora o ban; melhor ficar em silêncio e voltar gentilmente.
 */
const COOLDOWN_AFTER_429_MS = 5 * 60 * 1000;
let cooldownUntilMs = 0;

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|rate.?limit|too many|unavailable/i.test(msg);
}

export class GoogleTrendsRealProvider implements KeywordSourceProvider<TrendsData> {
  readonly source = 'trends' as const;
  readonly name = 'Google Trends';

  async fetch(term: string): Promise<TrendsData> {
    if (Date.now() < cooldownUntilMs) {
      const remainingSec = Math.ceil((cooldownUntilMs - Date.now()) / 1000);
      throw new Error(
        `Trends em cooldown (rate limit recente). Tente novamente em ${remainingSec}s.`
      );
    }

    try {
      const result = await this.fetchInner(term);
      recordSuccess('trends');
      return result;
    } catch (err) {
      recordFailure('trends', err);
      if (isRateLimitError(err)) {
        cooldownUntilMs = Date.now() + COOLDOWN_AFTER_429_MS;
      }
      throw err;
    }
  }

  private async fetchInner(term: string): Promise<TrendsData> {
    const startTime = new Date(Date.now() - 365 * 86_400_000);

    const interestRaw = await googleTrends.interestOverTime({
      keyword: term,
      startTime,
      geo: 'BR',
      hl: 'pt-BR',
    });

    let interestData: any;
    try {
      interestData = JSON.parse(interestRaw);
    } catch {
      throw new Error('Trends devolveu resposta inválida (provável rate limit).');
    }

    const timelineRaw: any[] = interestData?.default?.timelineData ?? [];
    const timeSeries: TrendsTimeSeriesPoint[] = timelineRaw.map((p) => {
      const ts = parseInt(p.time, 10);
      const d = new Date(ts * 1000);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const value = Array.isArray(p.value) && typeof p.value[0] === 'number' ? p.value[0] : 0;
      return { date: month, value };
    });

    // Aggregate the daily/weekly points into monthly buckets so the sparkline
    // matches the mock format and renders cleanly.
    const monthly = aggregateMonthly(timeSeries);

    let risingQueries: string[] = [];
    try {
      const relatedRaw = await googleTrends.relatedQueries({
        keyword: term,
        geo: 'BR',
        hl: 'pt-BR',
      });
      const related = JSON.parse(relatedRaw);
      const rising = related?.default?.rankedList?.[1]?.rankedKeyword ?? [];
      risingQueries = rising
        .slice(0, 5)
        .map((r: { query?: string }) => r.query ?? '')
        .filter(Boolean);
    } catch {
      // Optional — ignore failures.
    }

    const first = monthly[0]?.value ?? 0;
    const last = monthly[monthly.length - 1]?.value ?? 0;
    const delta = last - first;
    const trendDirection: TrendsData['trendDirection'] =
      delta > 8 ? 'rising' : delta < -8 ? 'declining' : 'stable';
    const trendScore = Math.round(clamp(50 + delta * 1.5, 0, 100));

    return {
      trendDirection,
      trendScore,
      timeSeries: monthly,
      risingQueries,
    };
  }
}

function aggregateMonthly(points: TrendsTimeSeriesPoint[]): TrendsTimeSeriesPoint[] {
  const buckets = new Map<string, number[]>();
  for (const p of points) {
    if (!buckets.has(p.date)) buckets.set(p.date, []);
    buckets.get(p.date)!.push(p.value);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      value: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    }));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
