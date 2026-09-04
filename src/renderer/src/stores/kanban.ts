// Estado global do board do Kanban.
//
// Vive fora da página por dois motivos:
//   1. Abertura instantânea — o board fica em memória entre navegações, e o
//      App faz o prefetch no boot, então clicar em "Kanban" renderiza na hora
//      em vez de esperar um round-trip de IPC.
//   2. Mudanças vindas de fora — o main emite `events:kanban-changed` em TODA
//      mutação do service, inclusive as que chegam pelo bridge HTTP local
//      (MCP do Claude Code). O App subscreve uma vez e o board se atualiza
//      sozinho, esteja a página montada ou não.
//
// O payload do board não carrega bytes de imagem (as thumbnails vêm pelo
// protocolo `isitube-thumb://`), então re-ler o board inteiro é barato.

import { create } from 'zustand';
import type { KanbanBoard } from '@shared/types';

interface KanbanStore {
  board: KanbanBoard | null;
  /** true só enquanto o primeiro fetch da sessão não voltou. */
  loading: boolean;
  /** Re-lê o board do main. Chamadas concorrentes são coalescidas. */
  refresh: () => Promise<void>;
  /** Busca só se ainda não temos board. Usado na montagem da página. */
  ensureLoaded: () => Promise<void>;
  /** Aplica um board local (update otimista); o refresh seguinte reconcilia. */
  setBoard: (board: KanbanBoard) => void;
  /** Move um card localmente pra o drag & drop não esperar o IPC. */
  moveCardLocal: (cardId: string, toColumnId: string, toPosition: number) => void;
}

// Coalescência: se um refresh chega enquanto outro está em voo, não abrimos
// uma segunda query — marcamos pra repetir uma vez ao terminar, pra não
// perder uma mudança que aconteceu depois da query atual ter começado.
let inFlight: Promise<void> | null = null;
let rerunQueued = false;

async function runRefresh(): Promise<void> {
  try {
    do {
      rerunQueued = false;
      const board = await window.api.kanban.getBoard();
      useKanbanStore.setState({ board, loading: false });
    } while (rerunQueued);
  } catch (err) {
    console.error('[kanban] falha ao carregar o board:', err);
    useKanbanStore.setState({ loading: false });
  } finally {
    inFlight = null;
  }
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  board: null,
  loading: true,

  refresh: () => {
    if (inFlight) {
      rerunQueued = true;
      return inFlight;
    }
    inFlight = runRefresh();
    return inFlight;
  },

  ensureLoaded: () => {
    if (get().board) return Promise.resolve();
    return get().refresh();
  },

  setBoard: (board) => set({ board, loading: false }),

  moveCardLocal: (cardId, toColumnId, toPosition) => {
    const board = get().board;
    if (!board) return;

    const moving = board.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
    if (!moving) return;

    const columns = board.columns.map((col) => {
      // Tira o card de onde estava (no-op nas colunas que não têm ele) e
      // insere no destino — mesma semântica do moveCard do main process.
      const cards = col.cards.filter((c) => c.id !== cardId);
      if (col.id === toColumnId) {
        const pos = Math.max(0, Math.min(toPosition, cards.length));
        cards.splice(pos, 0, { ...moving, columnId: toColumnId });
      }
      return { ...col, cards: cards.map((c, i) => ({ ...c, position: i })) };
    });

    set({ board: { columns } });
  },
}));
