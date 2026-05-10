import { ipcMain, shell } from 'electron';
import { checkForUpdates } from '../services/updates';

export function registerUpdatesHandlers(): void {
  ipcMain.handle('updates:check', async () => checkForUpdates());

  ipcMain.handle('updates:open-url', async (_event, url: unknown) => {
    if (typeof url !== 'string') throw new Error('updates:open-url expects a string url');
    if (!/^https?:\/\//.test(url)) throw new Error('updates:open-url rejects non-http urls');
    await shell.openExternal(url);
  });
}
