import { ipcMain } from 'electron';
import { listQuotaSnapshots } from '../services/external/quota';

export function registerQuotaHandlers(): void {
  ipcMain.handle('quota:list', () => listQuotaSnapshots());
}
