import type { TrendsData, TrendsTimeSeriesPoint } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { delay, pick, rangeInt, rng, strHash } from './utils';

const RISING_QUERY_TEMPLATES = [
  '{term} 2026',
  '{term} grátis',
  'curso de {term}',
  'tutorial {term}',
  'aprender {term} rápido',
  '{term} para iniciantes',
  '{term} avançado',
  'melhor {term}',
  'comprar {term}',
  '{term} barato',
];

/**
 * Phase 3 mock — Phase 8 will replace this with the unofficial Google Trends
 * API (e.g., google-trends-api or scraping the JSON endpoint).
 */
export class TrendsProvider implements KeywordSourceProvider<TrendsData> {
  readonly source = 'trends' as const;
  readonly name = 'Google Trends';

  async fetch(term: string): Promise<TrendsData> {
    await delay(500, 1400);

    const rand = rng(strHash(term) ^ 0xa5a5);

    // 12 monthly points
    const baseLevel = rangeInt(rand, 30, 70);
    const slope = rangeInt(rand, -8, 12); // negative = declining, positive = rising

    const timeSeries: TrendsTimeSeriesPoint[] = Array.from({ length: 12 }, (_, i) => {
      const monthsAgo = 11 - i;
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);
      const noise = rangeInt(rand, -8, 8);
      const value = clamp(baseLevel + slope * (i / 11) * 6 + noise, 0, 100);
      return {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        value: Math.round(value),
      };
    });

    const first = timeSeries[0]!.value;
    const last = timeSeries[timeSeries.length - 1]!.value;
    const delta = last - first;
    const trendDirection: TrendsData['trendDirection'] =
      delta > 8 ? 'rising' : delta < -8 ? 'declining' : 'stable';

    // Trend score: 0 strongly declining, 50 stable, 100 strongly rising.
    const trendScore = Math.round(clamp(50 + delta * 1.5, 0, 100));

    const risingQueries = Array.from({ length: 5 }, () =>
      pick(rand, RISING_QUERY_TEMPLATES).replace('{term}', term)
    );

    return {
      trendDirection,
      trendScore,
      timeSeries,
      risingQueries: Array.from(new Set(risingQueries)),
    };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
