import { useCallback, useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Card } from '../components/ui/Card';
import type { KeywordHistoryItem, KeywordResult, KeywordSourceStatuses } from '@shared/types';
import { SearchBar } from './keywords/SearchBar';
import { SourceStatusBar } from './keywords/SourceStatusBar';
import { KeywordResultCard } from './keywords/KeywordResultCard';
import { RelatedKeywordsPanel } from './keywords/RelatedKeywordsPanel';
import { HistoryList } from './keywords/HistoryList';
import { HelpDialog } from './keywords/HelpDialog';
import { SuggestionsPanel } from './keywords/SuggestionsPanel';
import { IdeaGenerator } from '../components/keywords/IdeaGenerator';
import { useRouterStore } from '../stores/router';

export function KeywordsPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KeywordResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<KeywordHistoryItem[]>([]);
  const [statuses, setStatuses] = useState<KeywordSourceStatuses | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const refreshHistory = useCallback(async () => {
    setHistory(await window.api.keywords.history(20));
  }, []);

  const refreshStatuses = useCallback(async () => {
    setStatuses(await window.api.keywords.getSourceStatuses());
  }, []);

  useEffect(() => {
    refreshHistory();
    refreshStatuses();
  }, [refreshHistory, refreshStatuses]);

  // Deep-link: se o Kanban (ou outra rota) pediu pra abrir um termo, dispara
  // a busca uma vez e consome o flag pra não repetir no próximo mount.
  const pendingTerm = useRouterStore((s) => s.pendingKeywordSearch);
  const consumePending = useRouterStore((s) => s.consumePendingKeywordSearch);
  useEffect(() => {
    if (pendingTerm) {
      runSearch(pendingTerm);
      consumePending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTerm]);

  const runSearch = useCallback(
    async (term: string, forceRefresh = false) => {
      setBusy(true);
      setError(null);
      setSearchTerm(term);
      try {
        const res = await window.api.keywords.search(term, { forceRefresh });
        setResult(res);
        refreshHistory();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha desconhecida na busca.');
      } finally {
        setBusy(false);
      }
    },
    [refreshHistory]
  );

  // Click numa ideia gerada (chip ou card) → preenche o campo de busca e
  // dispara a análise. O `runSearch` já atualiza `searchTerm` internamente.
  const handlePickIdea = useCallback(
    (term: string) => {
      runSearch(term);
    },
    [runSearch]
  );

  const enabledMap = statuses
    ? {
        scraping: statuses.scraping.enabled,
        keywordsEverywhere: statuses.keywordsEverywhere.enabled,
        trends: statuses.trends.enabled,
      }
    : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Palavras-chave</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Pesquise palavras-chave com volume real, concorrência, frescor e tendência. Receba
            um score 0-100 com normalização dinâmica quando uma fonte falha.
          </p>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <HelpCircle className="h-4 w-4" />
          Como funciona o score
        </button>
      </header>

      <SuggestionsPanel onSelectKeyword={(term) => runSearch(term)} />

      <IdeaGenerator onPickIdea={handlePickIdea} />

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Verificar volume de busca</h2>
        <SearchBar
          onSearch={(term) => runSearch(term)}
          busy={busy}
          currentTerm={searchTerm}
        />
        <div className="mt-4">
          <SourceStatusBar result={result} enabled={enabledMap} />
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </Card>

      {result && (
        <>
          <KeywordResultCard
            result={result}
            onRefresh={() => runSearch(result.term, true)}
            busy={busy}
          />
          <RelatedKeywordsPanel term={result.term} onPick={handlePickIdea} />
        </>
      )}

      <HistoryList items={history} onPick={(term) => runSearch(term)} />

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
