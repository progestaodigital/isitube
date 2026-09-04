import { useEffect, useMemo, useState } from 'react';
import { KanbanSquare, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToastStore } from '../stores/toast';
import { useKanbanStore } from '../stores/kanban';
import { KanbanColumnView } from './kanban/KanbanColumnView';
import { CardEditorModal } from './kanban/CardEditorModal';
import { PromptModal } from './kanban/PromptModal';
import type { KanbanCard, KanbanColumn } from '@shared/types';

type ColumnPromptState =
  | { kind: 'create' }
  | { kind: 'rename'; column: KanbanColumn }
  | null;

export function KanbanPage() {
  const showToast = useToastStore((s) => s.show);
  // O board vive no store global: fica quente entre navegações (abertura
  // instantânea) e se atualiza sozinho quando o main emite kanban-changed —
  // inclusive pra mudanças feitas pelo bridge/MCP.
  const board = useKanbanStore((s) => s.board);
  const loading = useKanbanStore((s) => s.loading);
  const refresh = useKanbanStore((s) => s.refresh);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [columnPrompt, setColumnPrompt] = useState<ColumnPromptState>(null);

  useEffect(() => {
    useKanbanStore.getState().ensureLoaded();
  }, []);

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

  async function handleCreateColumnConfirm(name: string) {
    try {
      await window.api.kanban.createColumn(name);
      await refresh();
      setColumnPrompt(null);
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao criar coluna',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleRenameColumnConfirm(columnId: string, name: string) {
    try {
      await window.api.kanban.renameColumn(columnId, name);
      await refresh();
      setColumnPrompt(null);
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao renomear',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleToggleCollapsed(col: KanbanColumn) {
    // Otimista: recolher/expandir é puramente visual, não faz sentido esperar
    // o round-trip. O evento kanban-changed reconcilia depois.
    if (board) {
      useKanbanStore.getState().setBoard({
        columns: board.columns.map((c) =>
          c.id === col.id ? { ...c, collapsed: !col.collapsed } : c
        ),
      });
    }
    await window.api.kanban.toggleColumnCollapsed(col.id, !col.collapsed);
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

    // Reordena localmente antes do IPC pro card "grudar" onde foi solto sem
    // esperar o banco. Se o move falhar, o refresh do catch desfaz.
    useKanbanStore.getState().moveCardLocal(draggingCardId, toColumnId, toPosition);

    try {
      await window.api.kanban.moveCard(draggingCardId, toColumnId, toPosition);
    } catch (err) {
      await refresh();
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
        <Button onClick={() => setColumnPrompt({ kind: 'create' })} variant="secondary">
          <Plus className="h-4 w-4" />
          Nova coluna
        </Button>
      </header>

      {!board ? (
        <p className="px-6 py-12 text-center text-sm text-zinc-500">
          {loading ? 'Carregando board…' : 'Não foi possível carregar o board.'}
        </p>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-6">
          <div className="flex h-full min-h-[400px] items-start gap-3">
            {board.columns.map((col) => (
              <KanbanColumnView
                key={col.id}
                column={col}
                draggingCardId={draggingCardId}
                onRename={() => setColumnPrompt({ kind: 'rename', column: col })}
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

      <PromptModal
        open={columnPrompt?.kind === 'create'}
        title="Nova coluna"
        description="Dê um nome pra essa coluna (ex.: Em produção, Gravando, Postado)."
        placeholder="Nome da coluna"
        initialValue="Nova coluna"
        confirmLabel="Criar"
        onConfirm={handleCreateColumnConfirm}
        onClose={() => setColumnPrompt(null)}
      />

      <PromptModal
        open={columnPrompt?.kind === 'rename'}
        title="Renomear coluna"
        initialValue={columnPrompt?.kind === 'rename' ? columnPrompt.column.name : ''}
        confirmLabel="Salvar"
        onConfirm={(name) => {
          if (columnPrompt?.kind === 'rename') {
            handleRenameColumnConfirm(columnPrompt.column.id, name);
          }
        }}
        onClose={() => setColumnPrompt(null)}
      />
    </div>
  );
}
