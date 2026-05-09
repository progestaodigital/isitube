import type { IsitubeAPI } from '@shared/types';

declare global {
  interface Window {
    api: IsitubeAPI;
  }
}

export {};
