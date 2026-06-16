import { create } from 'zustand';

export type View =
  | 'home'
  | 'channels'
  | 'keywords'
  | 'videos'
  | 'library'
  | 'settings'
  | 'help';

interface RouterStore {
  view: View;
  navigate: (view: View) => void;
}

export const useRouterStore = create<RouterStore>((set) => ({
  view: 'home',
  navigate: (view) => set({ view }),
}));
