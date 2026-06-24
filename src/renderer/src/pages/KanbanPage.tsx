import { useCallback, useEffect, useMemo, useState } from 'react';
import { KanbanSquare, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../stores/toast';
import { KanbanColumnView } from './kanban/KanbanColumnView';
import { CardEditorModal } from './kanban/CardEditorModal';
import type { KanbanBoard, KanbanCard, KanbanColumn } from '@shared/types';

export function KanbanPage() {
  const showToast = useToastStore((s) => s.show);
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBoard(await window.api.kanban.getBoard());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lookup do card sendo editado — precisa olhar o board atual pra refletir
  // mudanças vindas do editor sem precisar passar prop drilling.
  const editingCard = useMemo<KanbanCard | null>(() => {
    if (!editingCardId || !board) return null;
    for (const col of board.columns) {
      const found = col.cards.find((c) => c.id === editingCardId);
      if (found) return found;
    }
    return null;
  }, [editingCardId, board]);

  async function handleCreateColumn() {
    const name = window.prompt('Nome da nova coluna:', 'Nova coluna');
    if (!name || !name.trim()) return;
    try {
      await window.api.kanban.createColumn(name.trim());
      await refresh();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao criar coluna',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleRenameColumn(col: KanbanColumn) {
    const name = window.prompt('Renomear coluna:', col.name);
    if (!name || !name.trim() || name.trim() === col.name) return;
    try {
      await window.api.kanban.renameColumn(col.id, name.trim());
      await refresh();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao renomear',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleToggleCollapsed(col: KanbanColumn) {
    await window.api.kanban.toggleColumnCollapsed(col.id, !col.collapsed);
    await refresh();
  }

  async function handleDeleteColumn(col: KanbanColumn) {
    const ok = window.confirm(
      `Apagar coluna "${col.name}"?\n\n${col.cards.length} card${col.cards.length !== 1 ? 's' : ''} também serão apagados (sem volta).`
    );
    if (!ok) return;
    try {
      await window.api.kanban.deleteColumn(col.id);
      await refresh();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao apagar coluna',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleCreateCard(columnId: string) {
    try {
      const card = await window.api.kanban.createCard(columnId, '');
      await refresh();
      setEditingCardId(card.id);
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao criar card',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Drop handler genérico — aceita drop em coluna (append) ou em outro card
   * (insert before). targetCardId null = drop "no fim da coluna".
   */
  async function handleDropOnColumn(toColumnId: string, targetCardId: string | null) {
    if (!draggingCardId || !board) return;
    const targetColumn = board.columns.find((c) => c.id === toColumnId);
    if (!targetColumn) return;
    const draggedIdx = targetColumn.cards.findIndex((c) => c.id === draggingCardId);

    let toPosition: number;
    if (targetCardId === null) {
      // Drop no espaço vazio da coluna: vai pro fim. Se o card já tá nessa
      // coluna, o moveCard remove e reinsere — sem duplicação.
      toPosition = targetColumn.cards.length;
    } else {
      const targetIdx = targetColumn.cards.findIndex((c) => c.id === targetCardId);
      if (targetIdx < 0) return;
      // Insere antes do card alvo. Se o card arrastado tava antes do alvo
      // na mesma coluna, a posição "alvo" reduz em 1 porque o card sai
      // do meio antes de reinserir.
      toPosition =
        draggedIdx >= 0 && draggedIdx < targetIdx ? targetIdx - 1 : targetIdx;
    }

    try {
      await window.api.kanban.moveCard(draggingCardId, toColumnId, toPosition);
      await refresh();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao mover card',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDraggingCardId(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-end justify-between gap-4 px-6 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <KanbanSquare className="h-6 w-6 text-red-600" />
            Kanban
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Planeja os próximos vídeos: título, palavra-chave, roteiro, thumbnails e
            referências da biblioteca. Arrasta cards entre colunas pra mover pelo funil.
          </p>
        </div>
        <Button onClick={handleCreateColumn} variant="secondary">
          <Plus className="h-4 w-4" />
          Nova coluna
        </Button>
      </header>

      {!board ? (
        <p className="px-6 py-12 text-center text-sm text-zinc-500">Carregando board…</p>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-6">
          <div className="flex h-full min-h-[400px] items-start gap-3">
            {board.columns.map((col) => (
              <KanbanColumnView
                key={col.id}
                column={col}
                draggingCardId={draggingCardId}
                onRename={() => handleRenameColumn(col)}
                onToggleCollapsed={() => handleToggleCollapsed(col)}
                onDelete={() => handleDeleteColumn(col)}
                onCreateCard={() => handleCreateCard(col.id)}
                onEditCard={(card) => setEditingCardId(card.id)}
                onCardDragStart={(card) => setDraggingCardId(card.id)}
                onCardDragEnd={() => setDraggingCardId(null)}
                onDropOnCard={(targetCardId) => handleDropOnColumn(col.id, targetCardId)}
                onDropOnColumn={() => handleDropOnColumn(col.id, null)}
              />
            ))}
          </div>
        </div>
      )}

      <CardEditorModal
        card={editingCard}
        onClose={() => setEditingCardId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
