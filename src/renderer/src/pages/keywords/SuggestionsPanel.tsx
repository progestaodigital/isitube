import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, Flame, Sprout, ArrowRight, Hash, X } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import type { KeywordSuggestion, KeywordSuggestionsPayload } from '@shared/types';

type SuggestionTab = 'outliers' | 'evergreen';

interface SuggestionsPanelProps {
  onSelectKeyword: (term: string) => void;
}

export function SuggestionsPanel({ onSelectKeyword }: SuggestionsPanelProps) {
  const [data, setData] = useState<KeywordSuggestionsPayload | null>(null);
  const [tab, setTab] = useState<SuggestionTab>('outliers');
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await window.api.keywords.getSuggestions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh whenever an update run completes — new outliers may exist.
  useEffect(() => {
    const off = window.api.events.onUpdateRunCompleted(() => refresh());
    return off;
  }, [refresh]);

  const items = tab === 'outliers' ? data?.outliers ?? [] : data?.evergreen ?? [];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
            <Lightbulb className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Sugestões dos seus canais</h2>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Palavras-chave mineradas das tags e títulos dos seus vídeos. Sem IA, sem custo.
              Clica numa sugestão pra fazer a pesquisa completa com as 3 fontes.
            </p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {collapsed ? 'Expandir' : 'Recolher'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
            <TabButton
              active={tab === 'outliers'}
              onClick={() => setTab('outliers')}
              icon={Flame}
              label="Em destaque"
              count={data?.outliers.length ?? 0}
              tint="text-amber-600 dark:text-amber-400"
            />
            <TabButton
              active={tab === 'evergreen'}
              onClick={() => setTab('evergreen')}
              icon={Sprout}
              label="Evergreen"
              count={data?.evergreen.length ?? 0}
              tint="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          {loading && !data ? (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-zinc-500">
                {tab === 'outliers'
                  ? 'Nenhum candidato encontrado nos vídeos sinalizados. Pra resultados mais ricos, rode "Extrair informações" nos vídeos em destaque — isso popula as tags do criador (sinal mais forte que n-grams de título).'
                  : 'Nenhum vídeo evergreen ainda — precisa de pelo menos 2 atualizações pra calcular views/dia.'}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
              {items.map((s) => (
                <SuggestionItem
                  key={`${s.source}-${s.term}`}
                  suggestion={s}
                  onClick={() => onSelectKeyword(s.term)}
                  onExclude={async () => {
                    await window.api.keywords.excludeSuggestion(s.term);
                    refresh();
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  tint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Flame;
  label: string;
  count: number;
  tint: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-red-600 text-zinc-900 dark:text-zinc-50'
          : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      )}
    >
      <Icon className={cn('h-4 w-4', active && tint)} />
      {label}
      <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        {count}
      </span>
    </button>
  );
}

function SuggestionItem({
  suggestion,
  onClick,
  onExclude,
}: {
  suggestion: KeywordSuggestion;
  onClick: () => void;
  onExclude: () => void;
}) {
  const sourceLabel = suggestion.source === 'tag' ? 'tag' : 'título';
  const sourceClass =
    suggestion.source === 'tag'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

  return (
    <div className="group flex items-stretch gap-0 rounded-lg border border-zinc-200 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/40">
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left"
        title="Verificar volume de busca"
      >
        <Hash className="h-4 w-4 shrink-0 text-zinc-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{suggestion.term}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', sourceClass)}>
              {sourceLabel}
            </span>
            <span>
              {suggestion.occurrences} vídeo{suggestion.occurrences > 1 ? 's' : ''}
            </span>
            <span>{formatCompact(suggestion.totalViews)} views totais</span>
            {suggestion.shortsCount > 0 && suggestion.longCount > 0 && (
              <span>
                {suggestion.shortsCount} short{suggestion.shortsCount > 1 ? 's' : ''} ·{' '}
                {suggestion.longCount} longo{suggestion.longCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExclude();
        }}
        title="Excluir desta lista (não voltará a aparecer)"
        aria-label={`Excluir sugestão ${suggestion.term}`}
        className="flex shrink-0 items-center justify-center px-2 text-zinc-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
