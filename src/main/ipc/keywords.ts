import { ipcMain } from 'electron';
import {
  autocomplete,
  getSourceStatuses,
  listHistory,
  searchKeyword,
  setSourceEnabled,
} from '../services/keywords';
import { generateFreeIdeas } from '../services/keywords/free-ideas';
import {
  excludeSuggestion,
  getKeywordSuggestions,
} from '../services/keywords/suggestions';
import { GoogleTrendsRealProvider } from '../services/keywords/providers/trends-real';
import type { KeywordSearchOptions, KeywordSource } from '@shared/types';

const VALID_SOURCES: KeywordSource[] = ['scraping', 'keywords_everywhere', 'trends'];

function assertSource(value: unknown): asserts value is KeywordSource {
  if (typeof value !== 'string' || !VALID_SOURCES.includes(value as KeywordSource)) {
    throw new Error(`Invalid keyword source: ${String(value)}`);
  }
}

export function registerKeywordsHandlers(): void {
  ipcMain.handle(
    'keywords:search',
    async (_event, term: unknown, options: unknown) => {
      if (typeof term !== 'string') {
        throw new Error('keywords:search expects a string term');
      }
      const opts: KeywordSearchOptions =
        options && typeof options === 'object'
          ? { forceRefresh: Boolean((options as { forceRefresh?: unknown }).forceRefresh) }
          : {};
      return searchKeyword(term, opts);
    }
  );

  ipcMain.handle('keywords:history', async (_event, limit: unknown) => {
    const n = typeof limit === 'number' ? limit : 20;
    return listHistory(n);
  });

  ipcMain.handle('keywords:autocomplete', async (_event, prefix: unknown) => {
    if (typeof prefix !== 'string') return [];
    return autocomplete(prefix);
  });

  ipcMain.handle('keywords:get-source-statuses', async () => {
    return getSourceStatuses();
  });

  ipcMain.handle(
    'keywords:set-source-enabled',
    async (_event, source: unknown, enabled: unknown) => {
      assertSource(source);
      if (typeof enabled !== 'boolean') {
        throw new Error('keywords:set-source-enabled expects boolean enabled');
      }
      await setSourceEnabled(source, enabled);
    }
  );

  ipcMain.handle('keywords:generate-free-ideas', async (_event, seed: unknown) => {
    if (typeof seed !== 'string') {
      throw new Error('keywords:generate-free-ideas expects a string seed');
    }
    return generateFreeIdeas(seed);
  });

  ipcMain.handle('keywords:get-suggestions', async () => {
    return getKeywordSuggestions();
  });

  ipcMain.handle('keywords:exclude-suggestion', async (_event, term: unknown) => {
    if (typeof term !== 'string' || term.trim().length === 0) {
      throw new Error('keywords:exclude-suggestion expects a non-empty string');
    }
    await excludeSuggestion(term);
  });

  ipcMain.handle('keywords:test-trends', async () => {
    const provider = new GoogleTrendsRealProvider();
    const startedAt = Date.now();
    try {
      const result = await provider.fetch('youtube');
      const elapsedMs = Date.now() - startedAt;
      const points = result.timeSeries.length;
      return {
        success: true,
        message: `Conectado — Trends respondeu em ${elapsedMs}ms com ${points} pontos.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/429|rate.?limit|too many/i.test(message)) {
        return {
          success: false,
          message:
            'Rate limit do Google Trends. Aguarde alguns minutos e tente novamente.',
        };
      }
      return { success: false, message };
    }
  });
}
