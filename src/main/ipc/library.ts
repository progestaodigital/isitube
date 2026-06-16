import { ipcMain } from 'electron';
import {
  addToLibrary,
  countLibrary,
  listLibrary,
  removeFromLibrary,
  updateLibraryNotes,
} from '../services/library';
import type { LibraryFilters, VideoType } from '@shared/types';

const VALID_TYPES: VideoType[] = ['all', 'shorts', 'long', 'unknown'];
const VALID_SORTS: LibraryFilters['sort'][] = ['recent', 'oldest', 'mostViews', 'title'];

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:add', async (_event, videoId: unknown, notes: unknown) => {
    if (typeof videoId !== 'string') {
      throw new Error('library:add expects a string videoId');
    }
    const noteValue = typeof notes === 'string' ? notes : null;
    return addToLibrary(videoId, noteValue);
  });

  ipcMain.handle('library:remove', async (_event, videoId: unknown) => {
    if (typeof videoId !== 'string') {
      throw new Error('library:remove expects a string videoId');
    }
    return removeFromLibrary(videoId);
  });

  ipcMain.handle('library:update-notes', async (_event, videoId: unknown, notes: unknown) => {
    if (typeof videoId !== 'string') {
      throw new Error('library:update-notes expects a string videoId');
    }
    if (typeof notes !== 'string') {
      throw new Error('library:update-notes expects a string notes payload');
    }
    return updateLibraryNotes(videoId, notes);
  });

  ipcMain.handle('library:list', async (_event, filters: unknown) => {
    const f: LibraryFilters = {};
    if (filters && typeof filters === 'object') {
      const o = filters as Record<string, unknown>;
      if (typeof o.query === 'string') f.query = o.query;
      if (typeof o.channelId === 'string') f.channelId = o.channelId;
      if (typeof o.videoType === 'string' && VALID_TYPES.includes(o.videoType as VideoType)) {
        f.videoType = o.videoType as VideoType;
      }
      if (
        typeof o.sort === 'string' &&
        VALID_SORTS.includes(o.sort as LibraryFilters['sort'])
      ) {
        f.sort = o.sort as LibraryFilters['sort'];
      }
    }
    return listLibrary(f);
  });

  ipcMain.handle('library:count', async () => countLibrary());
}
