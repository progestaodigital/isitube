import { ipcMain } from 'electron';
import { listProviderSnapshots } from '../services/telemetry/providers';

export function registerHealthHandlers(): void {
  ipcMain.handle('health:list', () => listProviderSnapshots());
}
