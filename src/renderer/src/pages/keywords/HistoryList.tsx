import { Clock, Download } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { exportCsv } from '../../lib/exportCsv';
import type { KeywordHistoryItem } from '@shared/types';
import { cn } from '../../lib/cn';

interface HistoryListProps {
  items: KeywordHistoryItem[];
  onPick: (term: string) => void;
}

export function HistoryList({ items, onPick }: HistoryListProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold">Histórico</h3>
        </div>
        {items.length > 0 && (
          <Button
            onClick={() =>
              exportCsv(
                'historico-palavras-chave',
                ['id', 'termo', 'pesquisado_em', 'score'],
                items.map((it) => [it.id, it.term, it.searchedAt, it.scoreValue])
              )
            }
            variant="ghost"
            size="sm"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          Nada por aqui ainda. Pesquise uma palavra-chave acima.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onPick(item.term)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.term}</p>
                  <p className="text-[11px] text-zinc-500">
                    {new Date(item.searchedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <ScoreBadge value={item.scoreValue} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ScoreBadge({ value }: { value: number | null }) {
  const cls =
    value === null
      ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
      : value >= 60
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
        : value >= 30
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
  return (
    <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', cls)}>
      {value === null ? '—' : value}
    </span>
  );
}
