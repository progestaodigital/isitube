import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  loaded: boolean;
  load: () => Promise<void>;
  toggle: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'dark',
  loaded: false,

  load: async () => {
    const saved = await window.api.settings.get('theme');
    const theme: Theme = saved === 'light' ? 'light' : 'dark';
    set({ theme, loaded: true });
  },

  toggle: async () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    await window.api.settings.set('theme', next);
    set({ theme: next });
  },

  setTheme: async (theme) => {
    await window.api.settings.set('theme', theme);
    set({ theme });
  },
}));
