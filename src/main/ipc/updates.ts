import { app, ipcMain, shell } from 'electron';
import { checkForUpdates, downloadAndInstall, listAllReleases } from '../services/updates';

export function registerUpdatesHandlers(): void {
  ipcMain.handle('app:get-version', async () => app.getVersion());

  ipcMain.handle('updates:check', async () => checkForUpdates());

  ipcMain.handle('updates:list-all', async () => listAllReleases());

  ipcMain.handle(
    'updates:download-and-install',
    async (_event, assetId: unknown, fileName: unknown) => {
      if (typeof assetId !== 'number') {
        throw new Error('updates:download-and-install expects a number assetId');
      }
      if (typeof fileName !== 'string' || !fileName.endsWith('.exe')) {
        throw new Error('updates:download-and-install expects a string fileName .exe');
      }
      return downloadAndInstall(assetId, fileName);
    }
  );

  ipcMain.handle('updates:open-url', async (_event, url: unknown) => {
    if (typeof url !== 'string') throw new Error('updates:open-url expects a string url');
    if (!/^https?:\/\//.test(url)) throw new Error('updates:open-url rejects non-http urls');
    await shell.openExternal(url);
  });
}
