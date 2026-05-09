import type { KeywordsEverywhereData } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { delay, rangeFloat, rangeInt, rng, strHash } from './utils';

/**
 * Phase 3 mock — Phase 8 will replace this with real Keywords Everywhere
 * API calls (POST /api/v1/get_keyword_data).
 */
export class KeywordsEverywhereProvider
  implements KeywordSourceProvider<KeywordsEverywhereData>
{
  readonly source = 'keywords_everywhere' as const;
  readonly name = 'Keywords Everywhere';

  async fetch(term: string): Promise<KeywordsEverywhereData> {
    await delay(150, 450);

    const rand = rng(strHash(term) ^ 0x55aa); // different seed than scraping

    const volume = rangeInt(rand, 200, 80_000);
    const cpc = rangeFloat(rand, 0.05, 4.5);
    const difficultyScore = rangeInt(rand, 5, 95);

    return {
      volume,
      cpc: Math.round(cpc * 100) / 100,
      difficultyScore,
    };
  }
}
