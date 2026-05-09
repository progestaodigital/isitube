import type { ScrapingData, TopResult } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { average, daysSince, delay, pick, rangeInt, rng, strHash } from './utils';

const MOCK_CHANNELS = [
  'Canal do Pedrão',
  'Maria Conta',
  'Receitas da Dona Lurdes',
  'TecMundo Live',
  'Meu Canal Top',
  'Estúdio Brasil',
  'Conexão Criativa',
  'Mestre dos Tutoriais',
  'Vida Prática',
  'Histórias do Bê',
  'Renato Reviews',
  'Cláudia Fala',
  'Diário do Maker',
];

const TITLE_DECORATORS = [
  'definitivo',
  'completo',
  'fácil',
  'em 2026',
  'rápido',
  'em 5 minutos',
  'do zero ao avançado',
  'que você precisa saber',
  '— guia atualizado',
  'sem segredo',
  'que ninguém te conta',
];

/**
 * Phase 3 mock — Phase 8 will replace this with real YouTube SERP scraping
 * (search via the embedded Chromium, parse the result list).
 */
export class ScrapingProvider implements KeywordSourceProvider<ScrapingData> {
  readonly source = 'scraping' as const;
  readonly name = 'Scraping próprio';

  async fetch(term: string): Promise<ScrapingData> {
    await delay(900, 2200);

    const rand = rng(strHash(term));

    const topResults: TopResult[] = Array.from({ length: 10 }, (_, i) => {
      const decorator = pick(rand, TITLE_DECORATORS);
      return {
        position: i + 1,
        title: `${capitalize(term)} ${decorator}`,
        channelName: pick(rand, MOCK_CHANNELS),
        viewCount: rangeInt(rand, 5_000, 2_000_000),
        publishedAt: new Date(
          Date.now() - rangeInt(rand, 7, 540) * 86_400 * 1000
        ).toISOString(),
        videoId: mockVideoId(term, i),
      };
    });

    const ages = topResults.map((r) => daysSince(r.publishedAt));
    const averageAgeDays = average(ages);
    const highViewCountInTop = topResults.filter((r) => r.viewCount > 500_000).length;
    const averageViewsTop = average(topResults.map((r) => r.viewCount));

    // Simple competition score:
    //   - more high-view results = stronger competition
    //   - older average age = weaker competition (topic stale)
    // Bounded 0-100.
    const fromHighViews = (highViewCountInTop / 10) * 70; // up to 70 from saturation
    const fromAverageViews = Math.min(30, (averageViewsTop / 1_000_000) * 30);
    const competitionScore = clamp(fromHighViews + fromAverageViews, 0, 100);

    return {
      topResults,
      averageAgeDays,
      highViewCountInTop,
      averageViewsTop,
      competitionScore,
    };
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mockVideoId(term: string, index: number): string {
  // Synthetic 11-char id, deterministic by (term, index). Won't open a real
  // video on YouTube — clicks in dev mock will land on an empty page. Real
  // scraping returns actual ids.
  const seed = strHash(`${term}::${index}`);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let n = seed;
  let out = '';
  for (let i = 0; i < 11; i++) {
    n = (n * 9301 + 49297 + i * 7) >>> 0;
    out += alphabet[n % alphabet.length];
  }
  return out;
}
