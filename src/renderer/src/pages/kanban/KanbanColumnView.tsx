import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { KanbanCardView } from './KanbanCardView';
import type { KanbanCard, KanbanColumn } from '@shared/types';

interface KanbanColumnViewProps {
  column: KanbanColumn;
  draggingCardId: string | null;
  onRename: () => void;
  onToggleCollapsed: () => void;
  onDelete: () => void;
  onCreateCard: () => void;
  onEditCard: (card: KanbanCard) => void;
  onCardDragStart: (card: KanbanCard) => void;
  onCardDragEnd: () => void;
  onDropOnCard: (targetCardId: string) => void;
  onDropOnColumn: () => void;
}

export function KanbanColumnView({
  column,
  draggingCardId,
  onRename,
  onToggleCollapsed,
  onDelete,
  onCreateCard,
  onEditCard,
  onCardDragStart,
  onCardDragEnd,
  onDropOnCard,
  onDropOnColumn,
}: KanbanColumnViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function onColumnDragOver(e: React.DragEvent) {
    if (!draggingCardId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function onColumnDragLeave(e: React.DragEvent) {
    // Só limpa se saiu do container, não pra um filho.
    if (e.currentTarget === e.target) setDragOver(false);
  }

  function onColumnDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (draggingCardId) onDropOnColumn();
  }

  if (column.collapsed) {
    return (
      <div
        className="flex h-[calc(100vh-200px)] w-10 shrink-0 flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 py-3 dark:border-zinc-800 dark:bg-zinc-900/40"
        onDragOver={onColumnDragOver}
        onDragLeave={onColumnDragLeave}
        onDrop={onColumnDrop}
      >
        <button
          onClick={onToggleCollapsed}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="Expandir coluna"
          aria-label="Expandir coluna"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div
          className="flex flex-1 items-center justify-center"
          style={{ writingMode: 'vertical-rl' }}
        >
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {column.name}
          </span>
          <span className="ml-2 text-[10px] text-zinc-500">{column.cards.length}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-[calc(100vh-200px)] w-72 shrink-0 flex-col rounded-lg border bg-zinc-50 dark:bg-zinc-900/40',
        dragOver && draggingCardId
          ? 'border-red-400 ring-2 ring-red-500/40'
          : 'border-zinc-200 dark:border-zinc-800'
      )}
      onDragOver={onColumnDragOver}
      onDragLeave={onColumnDragLeave}
      onDrop={onColumnDrop}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <button
          onClick={onToggleCollapsed}
          className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="Recolher coluna"
          aria-label="Recolher coluna"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2
          className="flex-1 cursor-pointer truncate text-sm font-semibold"
          onDoubleClick={onRename}
          title="Duplo clique pra renomear"
        >
          {column.name}
        </h2>
        <span className="text-[11px] text-zinc-500">{column.cards.length}</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Mais opções"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Pencil className="h-3.5 w-3.5" />
                Renomear
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar coluna
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {column.cards.map((card) => (
          <KanbanCardView
            key={card.id}
            card={card}
            isDragging={draggingCardId === card.id}
            onEdit={() => onEditCard(card)}
            onDragStart={() => onCardDragStart(card)}
            onDragEnd={onCardDragEnd}
            onDropOnCard={() => onDropOnCard(card.id)}
            draggingCardId={draggingCardId}
          />
        ))}
        {column.cards.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] italic text-zinc-400">
            Sem cards. Adicione um abaixo.
          </p>
        )}
      </div>

      <button
        onClick={onCreateCard}
        className="flex shrink-0 items-center justify-center gap-1.5 border-t border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar card
      </button>
    </div>
  );
}
