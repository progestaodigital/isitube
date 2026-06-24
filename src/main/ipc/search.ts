import { ipcMain } from 'electron';
import { globalSearch } from '../services/search';

export function registerSearchHandlers(): void {
  ipcMain.handle('search:global', async (_event, query: unknown) => {
    if (typeof query !== 'string') {
      throw new Error('search:global expects a string query');
    }
    return globalSearch(query);
  });
}
