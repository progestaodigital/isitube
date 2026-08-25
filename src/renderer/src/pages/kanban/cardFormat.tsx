import type { KanbanCardFormat } from '@shared/types';
import { cn } from '../../lib/cn';

export const CARD_FORMATS: KanbanCardFormat[] = ['longo', 'short', 'live', 'estreia'];

export const FORMAT_META: Record<
  KanbanCardFormat,
  { label: string; short: string; badge: string; active: string }
> = {
  longo: {
    label: 'Vídeo longo',
    short: 'Longo',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    active: 'border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  },
  short: {
    label: 'Short',
    short: 'Short',
    badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300',
    active:
      'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300',
  },
  live: {
    label: 'Live',
    short: 'Live',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    active: 'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300',
  },
  estreia: {
    label: 'Estreia',
    short: 'Estreia',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    active:
      'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
};

/** Badge pequeno pro card do board. */
export function FormatBadge({ format }: { format: KanbanCardFormat }) {
  const m = FORMAT_META[format];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        m.badge
      )}
    >
      {m.short}
    </span>
  );
}
