import { ipcMain } from 'electron';
import { clearLicense, getLicense, setLicenseKey } from '../services/license';

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:get', async (_event, forceRefresh: unknown) => {
    return getLicense(forceRefresh === true);
  });

  ipcMain.handle('license:set', async (_event, key: unknown) => {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Chave de licença obrigatória.');
    }
    return setLicenseKey(key.trim());
  });

  ipcMain.handle('license:clear', async () => {
    await clearLicense();
  });
}
