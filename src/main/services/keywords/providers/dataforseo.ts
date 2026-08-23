import type { KeywordsEverywhereData } from '@shared/types';
import type { KeywordSourceProvider } from './types';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

// Google Ads search_volume: funciona pra QUALQUER keyword que tenha volume real
// (consulta o Google Ads direto, não um banco pré-montado). Devolve volume como
// número único (sem faixa), CPC e competition. Termo nicho demais (long-tail que
// ninguém pesquisa) volta com tudo null — aí NÃO tem volume em lugar nenhum: a
// gente lança erro pra fonte cair como indisponível e o score renormalizar
// (scraping + trends), em vez de fingir volume 0 e derrubar a nota.
const ENDPOINT = 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';
const LOCATION_CODE = 2076; // Brasil
const LANGUAGE_CODE = 'pt';

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

  async fetch(term: string): Promise<KeywordsEverywhereData> {
    const auth = Buffer.from(`${this.login}:${this.password}`).toString('base64');

    let task: any;
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { keywords: [term], location_code: LOCATION_CODE, language_code: LANGUAGE_CODE },
        ]),
      });
      const json = await res.json();
      // status_code do TOPO = transporte/auth.
      if (!res.ok || json?.status_code !== 20000) {
        throw new Error(json?.status_message ?? `DataForSEO erro ${res.status}`);
      }
      // status_code da TASK = a consulta em si (plano, saldo, parâmetro).
      task = json?.tasks?.[0];
      if (!task || task.status_code !== 20000) {
        throw new Error(
          task?.status_message
            ? `DataForSEO: ${task.status_message}`
            : 'DataForSEO: task sem resultado.'
        );
      }
      recordSuccess('dataforseo');
    } catch (err) {
      recordFailure('dataforseo', err);
      throw err;
    }

    const r0 = task.result?.[0];
    // search_volume null = Google Ads não tem dados desse termo (nicho demais).
    // Erro proposital: o enricher marca a fonte como indisponível e renormaliza
    // o score, em vez de tratar como "keyword com volume 0" e derrubar a nota.
    if (!r0 || typeof r0.search_volume !== 'number') {
      throw new Error('Sem dados de volume pra esse termo (muito específico/nicho).');
    }

    const volume = r0.search_volume;
    const cpc = typeof r0.cpc === 'number' ? r0.cpc : 0;
    // competition_index é 0-100 (melhor); competition às vezes vem 0-1.
    let difficultyScore = 0;
    if (typeof r0.competition_index === 'number') {
      difficultyScore = Math.round(r0.competition_index);
    } else if (typeof r0.competition === 'number') {
      difficultyScore = Math.round(Math.min(1, Math.max(0, r0.competition)) * 100);
    }

    return { volume, cpc, difficultyScore };
  }
}
