import { BrowserWindow, ipcMain } from 'electron';
import {
  deleteCredential,
  listCredentialStatuses,
  setCredential,
  testCredential,
} from '../services/credentials';
import type { CredentialProvider } from '@shared/types';

const VALID_PROVIDERS: CredentialProvider[] = [
  'anthropic',
  'youtube',
  'keywords_everywhere',
  'google_ai',
  'github',
];

function assertProvider(value: unknown): asserts value is CredentialProvider {
  if (
    typeof value !== 'string' ||
    !VALID_PROVIDERS.includes(value as CredentialProvider)
  ) {
    throw new Error(`Invalid provider: ${String(value)}`);
  }
}

function broadcastCredentialsChanged(provider: CredentialProvider): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('events:credentials-changed', { provider });
  }
}

export function registerCredentialsHandlers(): void {
  ipcMain.handle('credentials:list', async () => {
    return listCredentialStatuses();
  });

  ipcMain.handle('credentials:set', async (_event, provider: unknown, plainKey: unknown) => {
    assertProvider(provider);
    if (typeof plainKey !== 'string') {
      throw new Error('credentials:set expects a string key');
    }
    const result = await setCredential(provider, plainKey);
    if (result.success) broadcastCredentialsChanged(provider);
    return result;
  });

  ipcMain.handle('credentials:delete', async (_event, provider: unknown) => {
    assertProvider(provider);
    await deleteCredential(provider);
    broadcastCredentialsChanged(provider);
  });

  ipcMain.handle('credentials:test', async (_event, provider: unknown) => {
    assertProvider(provider);
    const result = await testCredential(provider);
    // Test result changes the credential's status, so broadcast either way.
    broadcastCredentialsChanged(provider);
    return result;
  });
}
