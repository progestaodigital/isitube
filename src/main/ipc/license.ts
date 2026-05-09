import { ipcMain } from 'electron';
import { getLicense } from '../services/license';

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:get', async (_event, forceRefresh: unknown) => {
    return getLicense(forceRefresh === true);
  });
}
