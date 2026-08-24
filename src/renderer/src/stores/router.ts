import { create } from 'zustand';

export type View =
  | 'home'
  | 'channels'
  | 'keywords'
  | 'videos'
  | 'library'
  | 'kanban'
  | 'thumbnails'
  | 'criar'
  | 'meu-canal'
  | 'settings'
  | 'help';

/** Payload pra abrir o criador de thumbnails já preenchido (deep-link do card). */
export type PendingThumbnail = {
  brief: string;
  /** Pré-selecionar N thumbnails da Biblioteca como referência de estilo. */
  preselectStyleRefs: number;
};

interface RouterStore {
  view: View;
  /** Termo a pesquisar quando entrar em 'keywords' (deep-link do Kanban). */
  pendingKeywordSearch: string | null;
  /** Brief/refs a preencher quando entrar em 'thumbnails' (deep-link do card). */
  pendingThumbnail: PendingThumbnail | null;
  navigate: (view: View) => void;
  navigateToKeywordSearch: (term: string) => void;
  consumePendingKeywordSearch: () => void;
  navigateToThumbnailCreate: (payload: PendingThumbnail) => void;
  consumePendingThumbnail: () => void;
}

export const useRouterStore = create<RouterStore>((set) => ({
  view: 'home',
  pendingKeywordSearch: null,
  pendingThumbnail: null,
  navigate: (view) => set({ view }),
  navigateToKeywordSearch: (term: string) =>
    set({ view: 'keywords', pendingKeywordSearch: term }),
  consumePendingKeywordSearch: () => set({ pendingKeywordSearch: null }),
  navigateToThumbnailCreate: (payload: PendingThumbnail) =>
    set({ view: 'thumbnails', pendingThumbnail: payload }),
  consumePendingThumbnail: () => set({ pendingThumbnail: null }),
}));
