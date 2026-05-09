import type { KeywordsEverywhereData } from '@shared/types';
import type { KeywordSourceProvider } from './types';

const API_URL = 'https://api.keywordseverywhere.com/v1/get_keyword_data';

/**
 * Real Keywords Everywhere provider. Costs 1 credit per keyword queried.
 * Each user pays for their own quota — minimum US$10 buys 100k credits.
 */
export class KeywordsEverywhereRealProvider
  implements KeywordSourceProvider<KeywordsEverywhereData>
{
  readonly source = 'keywords_everywhere' as const;
  readonly name = 'Keywords Everywhere';

  constructor(private readonly apiKey: string) {}

  async fetch(term: string): Promise<KeywordsEverywhereData> {
    const formData = new URLSearchParams();
    formData.append('country', 'br');
    formData.append('currency', 'BRL');
    formData.append('dataSource', 'gkp');
    formData.append('kw[]', term);

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!res.ok) {
      let msg = `Keywords Everywhere API error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message) msg = body.message;
      } catch {
        /* swallow non-JSON */
      }
      throw new Error(msg);
    }

    const json = await res.json();
    const data = json?.data?.[0];
    if (!data) throw new Error('Keywords Everywhere não retornou dados pra esse termo.');

    const cpcValue =
      typeof data.cpc === 'object'
        ? parseFloat(data.cpc?.value ?? '0')
        : parseFloat(data.cpc ?? '0');

    // KE returns competition as a 0-1 float (0 = none, 1 = max).
    const competition = parseFloat(data.competition ?? '0');

    return {
      volume: typeof data.vol === 'number' ? data.vol : Number(data.vol ?? 0),
      cpc: Number.isFinite(cpcValue) ? cpcValue : 0,
      difficultyScore: Math.round(Math.min(1, Math.max(0, competition)) * 100),
    };
  }
}
