import { ipcMain } from 'electron';
import {
  createCardFromIdea,
  deleteSavedIdea,
  generateAndSaveIdeas,
  listSavedIdeas,
} from '../services/ideas';
import type { IdeateInput } from '@shared/types';

export function registerIdeasHandlers(): void {
  ipcMain.handle('ideas:generate', async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      throw new Error('ideas:generate expects an input object');
    }
    const typed = input as IdeateInput;
    if (typeof typed.niche !== 'string' || typed.niche.trim().length === 0) {
      throw new Error('ideas:generate expects a non-empty niche');
    }
    return generateAndSaveIdeas(typed);
  });

  ipcMain.handle('ideas:list', async () => {
    return listSavedIdeas();
  });

  ipcMain.handle('ideas:delete', async (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('ideas:delete expects an id');
    }
    await deleteSavedIdea(id);
  });

  ipcMain.handle('ideas:create-card', async (_event, id: unknown) => {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error('ideas:create-card expects an id');
    }
    return createCardFromIdea(id);
  });
}
