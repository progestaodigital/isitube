import type { KeywordResult, SourceStatus } from '@shared/types';
import { cn } from '../../lib/cn';

interface SourceStatusBarProps {
  result?: KeywordResult | null;
  enabled?: { scraping: boolean; keywordsEverywhere: boolean; trends: boolean };
}

const SOURCES = [
  { key: 'scraping', label: 'Scraping' },
  { key: 'keywordsEverywhere', label: 'Keywords Everywhere' },
  { key: 'trends', label: 'Tendências' },
] as const;

export function SourceStatusBar({ result, enabled }: SourceStatusBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {SOURCES.map((s) => {
        const status: SourceStatus | 'pending' = result
          ? result[s.key].status
          : enabled
            ? enabled[s.key as keyof typeof enabled]
              ? 'pending'
              : 'disabled'
            : 'pending';
        const color = colorFor(status);
        const label = labelFor(status);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className={cn('inline-block h-2.5 w-2.5 rounded-full', color)} />
            <span className="text-xs text-zinc-700 dark:text-zinc-300">{s.label}</span>
            <span className="text-[11px] text-zinc-500">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function colorFor(status: SourceStatus | 'pending'): string {
  switch (status) {
    case 'ok':
      return 'bg-emerald-500';
    case 'error':
    case 'unavailable':
      return 'bg-red-500';
    case 'disabled':
      return 'bg-zinc-400';
    case 'pending':
      return 'bg-amber-400 animate-pulse';
  }
}

function labelFor(status: SourceStatus | 'pending'): string {
  switch (status) {
    case 'ok':
      return 'ok';
    case 'error':
      return 'erro';
    case 'unavailable':
      return 'indisponível';
    case 'disabled':
      return 'desativado';
    case 'pending':
      return 'aguardando...';
  }
}
