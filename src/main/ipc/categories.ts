import { ipcMain } from 'electron';
import {
  createCategory,
  deleteCategory,
  listCategories,
  setChannelCategories,
  updateCategory,
} from '../services/categories';

export function registerCategoriesHandlers(): void {
  ipcMain.handle('categories:list', async () => listCategories());

  ipcMain.handle('categories:create', async (_event, name: unknown, color: unknown) => {
    if (typeof name !== 'string') throw new Error('categories:create expects a string name');
    return createCategory(name, typeof color === 'string' ? color : null);
  });

  ipcMain.handle(
    'categories:update',
    async (_event, id: unknown, name: unknown, color: unknown) => {
      if (typeof id !== 'string' || typeof name !== 'string') {
        throw new Error('categories:update expects (id: string, name: string, color?: string|null)');
      }
      return updateCategory(id, name, typeof color === 'string' ? color : null);
    }
  );

  ipcMain.handle('categories:delete', async (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('categories:delete expects a string id');
    await deleteCategory(id);
  });

  ipcMain.handle(
    'categories:set-for-channel',
    async (_event, channelId: unknown, categoryIds: unknown) => {
      if (typeof channelId !== 'string') {
        throw new Error('categories:set-for-channel expects a string channelId');
      }
      if (!Array.isArray(categoryIds) || categoryIds.some((id) => typeof id !== 'string')) {
        throw new Error('categories:set-for-channel expects an array of string ids');
      }
      await setChannelCategories(channelId, categoryIds as string[]);
    }
  );
}
