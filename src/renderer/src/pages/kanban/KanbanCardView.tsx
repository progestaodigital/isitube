import { useState } from 'react';
import { Image as ImageIcon, Hash, BookMarked, FileText, Sparkles, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/cn';
import { FormatBadge } from './cardFormat';
import type { KanbanCard } from '@shared/types';

interface KanbanCardViewProps {
  card: KanbanCard;
  isDragging: boolean;
  draggingCardId: string | null;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOnCard: () => void;
}

export function KanbanCardView({
  card,
  isDragging,
  draggingCardId,
  onEdit,
  onDragStart,
  onDragEnd,
  onDropOnCard,
}: KanbanCardViewProps) {
  const [dragOver, setDragOver] = useState(false);

  const cover = card.thumbnails.find((t) => t.id === card.coverThumbnailId);
  const refCount = card.references.length;
  const hasScript = Boolean(card.script && card.script.trim());
  const hasPlanning = Boolean(card.planning && card.planning.trim());

  function onCardDragOver(e: React.DragEvent) {
    if (!draggingCardId || draggingCardId === card.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function onCardDragLeave() {
    setDragOver(false);
  }

  function onCardDrop(e: React.DragEvent) {
    if (!draggingCardId || draggingCardId === card.id) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    onDropOnCard();
  }

  return (
    <article
      draggable
      onDragStart={(e) => {
        // Setamos o dataTransfer pra Chrome aceitar o drag; conteúdo real
        // tá no parent state (draggingCardId). String vazia funciona no
        // Chromium, mas usamos o id como guard contra drop em si próprio.
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onCardDragOver}
      onDragLeave={onCardDragLeave}
      onDrop={onCardDrop}
      onClick={onEdit}
      className={cn(
        'cursor-pointer overflow-hidden rounded-md border bg-white shadow-sm transition-all dark:bg-zinc-900',
        isDragging
          ? 'opacity-40'
          : dragOver
            ? 'border-red-400 ring-2 ring-red-500/40'
            : 'border-zinc-200 hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:hover:border-zinc-700'
      )}
    >
      {cover && (
        <div className="aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img
            src={cover.url}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
      )}
      <div className="space-y-1.5 p-2.5">
        {card.format && (
          <div>
            <FormatBadge format={card.format} />
          </div>
        )}
        <h3 className={cn('text-sm font-medium leading-snug', !card.title && 'italic text-zinc-400')}>
          {card.title || 'Sem título'}
        </h3>
        {card.mainKeyword && (
          <div className="flex items-center gap-1 text-[11px]">
            <Hash className="h-3 w-3 text-zinc-400" />
            <span className="truncate text-zinc-600 dark:text-zinc-400">
              {card.mainKeyword}
            </span>
            {card.keywordAnalysis?.cached && card.keywordAnalysis.scoreValue !== null && (
              <span
                className={cn(
                  'ml-auto inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  scoreBadgeColor(card.keywordAnalysis.scoreValue)
                )}
                title={`Score ${Math.round(card.keywordAnalysis.scoreValue)} — análise cacheada`}
              >
                <Sparkles className="h-2.5 w-2.5" />
                {Math.round(card.keywordAnalysis.scoreValue)}
              </span>
            )}
          </div>
        )}
        {(card.thumbnails.length > 1 || refCount > 0 || hasScript || hasPlanning) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
            {card.thumbnails.length > 1 && (
              <span className="inline-flex items-center gap-0.5">
                <ImageIcon className="h-3 w-3" />
                {card.thumbnails.length}
              </span>
            )}
            {refCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <BookMarked className="h-3 w-3" />
                {refCount}
              </span>
            )}
            {hasScript && (
              <span className="inline-flex items-center gap-0.5">
                <FileText className="h-3 w-3" />
                roteiro
              </span>
            )}
            {hasPlanning && (
              <span className="inline-flex items-center gap-0.5">
                <ClipboardList className="h-3 w-3" />
                planejamento
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function scoreBadgeColor(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}
