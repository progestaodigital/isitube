import { ipcMain } from 'electron';
import { exportBackup, inspectBackup, restoreBackup } from '../services/backup';
import {
  getGithubBackupConfig,
  listGithubBackups,
  listGithubRepos,
  restoreFromGithub,
  setGithubBackupConfig,
  uploadBackupToGithub,
} from '../services/backup/github';

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:export', async () => exportBackup());

  ipcMain.handle('backup:inspect', async () => inspectBackup());

  ipcMain.handle('backup:restore', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') {
      throw new Error('backup:restore expects a string filePath');
    }
    return restoreBackup(filePath);
  });

  ipcMain.handle('backup:github:get-config', async () => getGithubBackupConfig());

  ipcMain.handle('backup:github:set-config', async (_event, repo: unknown) => {
    if (typeof repo !== 'string') {
      throw new Error('backup:github:set-config expects a string repo');
    }
    await setGithubBackupConfig(repo);
  });

  ipcMain.handle('backup:github:list-repos', async () => listGithubRepos());

  ipcMain.handle('backup:github:upload', async () => uploadBackupToGithub());

  ipcMain.handle('backup:github:list', async () => listGithubBackups());

  ipcMain.handle('backup:github:restore', async (_event, releaseId: unknown) => {
    if (typeof releaseId !== 'number') {
      throw new Error('backup:github:restore expects a number releaseId');
    }
    return restoreFromGithub(releaseId);
  });
}
