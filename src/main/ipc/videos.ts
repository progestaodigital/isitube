import { ipcMain } from 'electron';
import {
  extractVideoMetadata,
  getVideoDetail,
  listExtractedVideos,
  removeVideo,
  removeVideos,
} from '../services/videos';
import type { ExtractedVideosFilters, VideoType } from '@shared/types';

const VALID_TYPES: VideoType[] = ['all', 'shorts', 'long', 'unknown'];

export function registerVideosHandlers(): void {
  ipcMain.handle('videos:get-detail', async (_event, videoId: unknown) => {
    if (typeof videoId !== 'string') throw new Error('videos:get-detail expects a string id');
    return getVideoDetail(videoId);
  });

  ipcMain.handle('videos:extract-metadata', async (_event, videoId: unknown) => {
    if (typeof videoId !== 'string') throw new Error('videos:extract-metadata expects a string id');
    return extractVideoMetadata(videoId);
  });

  ipcMain.handle('videos:list-extracted', async (_event, filters: unknown) => {
    const f: ExtractedVideosFilters = {};
    if (filters && typeof filters === 'object') {
      const o = filters as Record<string, unknown>;
      if (typeof o.channelId === 'string') f.channelId = o.channelId;
      if (typeof o.flaggedOnly === 'boolean') f.flaggedOnly = o.flaggedOnly;
      if (typeof o.videoType === 'string' && VALID_TYPES.includes(o.videoType as VideoType)) {
        f.videoType = o.videoType as VideoType;
      }
    }
    return listExtractedVideos(f);
  });

  ipcMain.handle('videos:remove', async (_event, videoId: unknown) => {
    if (typeof videoId !== 'string') throw new Error('videos:remove expects a string id');
    await removeVideo(videoId);
  });

  ipcMain.handle('videos:remove-many', async (_event, ids: unknown) => {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      throw new Error('videos:remove-many expects an array of string ids');
    }
    return removeVideos(ids as string[]);
  });
}
