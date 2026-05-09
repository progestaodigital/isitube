import { create } from 'zustand';

interface VideoDetailStore {
  videoId: string | null;
  open: (videoId: string) => void;
  close: () => void;
}

/**
 * Global state for the video detail modal. Any component can open the modal
 * with `useVideoDetailStore.getState().open(videoId)` — no prop drilling.
 */
export const useVideoDetailStore = create<VideoDetailStore>((set) => ({
  videoId: null,
  open: (videoId) => set({ videoId }),
  close: () => set({ videoId: null }),
}));
