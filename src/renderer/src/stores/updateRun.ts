// Estado global "tem update rodando agora?". Alimentado pelos eventos
// `events:update-run-started` (main → renderer no boot do run) e
// `events:update-run-completed` (no fim). Sobrevive a navegação entre
// páginas — o componente App subscreve aos 2 eventos uma única vez no
// boot e mantém o store em sync independente do que está montado.
//
// Páginas que mostram "Atualizando..." (HomePage, ChannelsPage) e o
// indicador discreto no Header leem `isRunning` daqui em vez de manter
// useState local.

import { create } from 'zustand';
import type { UpdateRunInfo } from '@shared/types';

interface UpdateRunStore {
  isRunning: boolean;
  /** Run em curso, se houver. Null entre runs. */
  current: UpdateRunInfo | null;
  /** Último run completado (sucesso ou falha). Útil pra mostrar "última atualização: agora". */
  lastCompleted: UpdateRunInfo | null;
  start: (run: UpdateRunInfo) => void;
  complete: (run: UpdateRunInfo) => void;
}

export const useUpdateRunStore = create<UpdateRunStore>((set) => ({
  isRunning: false,
  current: null,
  lastCompleted: null,
  start: (run) => set({ isRunning: true, current: run }),
  complete: (run) => set({ isRunning: false, current: null, lastCompleted: run }),
}));
