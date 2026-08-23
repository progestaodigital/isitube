import { useEffect, useState } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import type { RelatedKeyword } from '@shared/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface RelatedKeywordsPanelProps {
  term: string;
  onPick: (term: string) => void;
}

/**
 * Ideias de palavras-chave relacionadas (DataForSEO), com volume real. On-demand
 * — só busca quando o usuário clica, porque é uma consulta paga separada. Reseta
 * ao trocar de termo pra não misturar ideias do termo anterior.
 */
export function RelatedKeywordsPanel({ term, onPick }: RelatedKeywordsPanelProps) {
  const [items, setItems] = useState<RelatedKeyword[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    setLoadedFor(null);
  }, [term]);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await window.api.keywords.relatedKeywords(term);
      setItems(res.items);
      setLoadedFor(term);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao buscar ideias.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Ideias de palavras-chave
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Termos relacionados a “{term}” com volume real (DataForSEO). Cada busca é uma consulta
            paga.
          </p>
        </div>
        {loadedFor !== term && (
          <Button onClick={load} disabled={busy} variant="secondary" size="sm">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            {busy ? 'Buscando…' : 'Buscar ideias'}
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {items && items.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">Nenhuma ideia relacionada encontrada.</p>
      )}

      {items && items.length > 0 && (
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {items.map((k) => (
            <li key={k.keyword}>
              <button
                onClick={() => onPick(k.keyword)}
                className="group flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                title="Analisar essa palavra-chave"
              >
                <span className="min-w-0 flex-1 truncate text-sm group-hover:text-red-600 dark:group-hover:text-red-400">
                  {k.keyword}
                </span>
                <span className="shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {k.volume != null ? `${k.volume.toLocaleString('pt-BR')}/mês` : '—'}
                </span>
                {k.difficultyScore != null && (
                  <span className="shrink-0 text-xs text-zinc-400">dif {k.difficultyScore}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
