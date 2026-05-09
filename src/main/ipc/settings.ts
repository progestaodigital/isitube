import { ipcMain } from 'electron';
import { getSetting, setSetting } from '../services/settings';

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    if (typeof key !== 'string') throw new Error('settings:get expects string key');
    return getSetting(key);
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new Error('settings:set expects string key and value');
    }
    await setSetting(key, value);
  });
}
