import { ipcMain } from 'electron';
import {
  getBridgeStatus,
  setBridgeEnabled,
  regenerateBridgeToken,
} from '../services/bridge';

export function registerBridgeHandlers(): void {
  ipcMain.handle('bridge:status', async () => getBridgeStatus());

  ipcMain.handle('bridge:set-enabled', async (_e, enabled: unknown) => {
    await setBridgeEnabled(enabled === true);
    return getBridgeStatus();
  });

  ipcMain.handle('bridge:regenerate-token', async () => {
    await regenerateBridgeToken();
    return getBridgeStatus();
  });
}
