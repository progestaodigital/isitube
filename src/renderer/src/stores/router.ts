import { create } from 'zustand';

export type View =
  | 'home'
  | 'channels'
  | 'keywords'
  | 'videos'
  | 'library'
  | 'kanban'
  | 'thumbnails'
  | 'meu-canal'
  | 'settings'
  | 'help';

interface RouterStore {
  view: View;
  /** Termo a pesquisar quando entrar em 'keywords' (deep-link do Kanban). */
  pendingKeywordSearch: string | null;
  navigate: (view: View) => void;
  navigateToKeywordSearch: (term: string) => void;
  consumePendingKeywordSearch: () => void;
}

export const useRouterStore = create<RouterStore>((set) => ({
  view: 'home',
  pendingKeywordSearch: null,
  navigate: (view) => set({ view }),
  navigateToKeywordSearch: (term: string) =>
    set({ view: 'keywords', pendingKeywordSearch: term }),
  consumePendingKeywordSearch: () => set({ pendingKeywordSearch: null }),
}));
