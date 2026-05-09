import { ipcMain } from 'electron';
import {
  addChannel,
  backfillChannel,
  dismissStartupSuggestion,
  getChannelVideos,
  getFlaggedVideos,
  getStartupAction,
  listChannels,
  listUpdateRuns,
  removeAllChannelsAndVideos,
  removeChannel,
  removeChannels,
  runUpdateAll,
} from '../services/channels';
import {
  getChannelsTimeSeries,
  getEvergreenReadiness,
  getEvergreenVideos,
} from '../services/channels/analytics';
import { broadcastUpdateRunCompleted } from '../services/channels/scheduler';
import type {
  ChannelTimeSeriesMetric,
  EvergreenFilters,
  FlaggedVideosFilters,
  VideoType,
} from '@shared/types';

const VALID_TYPES: VideoType[] = ['all', 'shorts', 'long'];
const VALID_METRICS: ChannelTimeSeriesMetric[] = [
  'totalViews',
  'viewsPerDay',
  'subscribers',
];

export function registerChannelsHandlers(): void {
  ipcMain.handle(
    'channels:add',
    async (_event, urlOrId: unknown, categoryIds: unknown) => {
      if (typeof urlOrId !== 'string') {
        throw new Error('channels:add expects a string url or id');
      }
      const ids =
        Array.isArray(categoryIds) && categoryIds.every((id) => typeof id === 'string')
          ? (categoryIds as string[])
          : [];
      return addChannel(urlOrId, ids);
    }
  );

  ipcMain.handle('channels:list', async (_event, filters: unknown) => {
    const f: { categoryIds?: string[] } = {};
    if (filters && typeof filters === 'object') {
      const o = filters as Record<string, unknown>;
      if (
        Array.isArray(o.categoryIds) &&
        o.categoryIds.every((id) => typeof id === 'string')
      ) {
        f.categoryIds = o.categoryIds as string[];
      }
    }
    return listChannels(f);
  });

  ipcMain.handle('channels:remove', async (_event, channelId: unknown) => {
    if (typeof channelId !== 'string') throw new Error('channels:remove expects a string id');
    await removeChannel(channelId);
  });

  ipcMain.handle('channels:remove-many', async (_event, ids: unknown) => {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      throw new Error('channels:remove-many expects an array of string ids');
    }
    return removeChannels(ids as string[]);
  });

  ipcMain.handle('channels:remove-all', async () => {
    return removeAllChannelsAndVideos();
  });

  ipcMain.handle('channels:update-all', async (_event, triggeredBy: unknown) => {
    const tb =
      triggeredBy === 'manual' || triggeredBy === 'scheduled' || triggeredBy === 'startup'
        ? triggeredBy
        : 'manual';
    const run = await runUpdateAll(tb);
    broadcastUpdateRunCompleted(run);
    return run;
  });

  ipcMain.handle('channels:get-flagged-videos', async (_event, filters: unknown) => {
    const f: FlaggedVideosFilters = {};
    if (filters && typeof filters === 'object') {
      const o = filters as Record<string, unknown>;
      if (typeof o.channelId === 'string') f.channelId = o.channelId;
      if (typeof o.sinceDays === 'number') f.sinceDays = o.sinceDays;
      if (typeof o.minPercent === 'number') f.minPercent = o.minPercent;
      if (typeof o.videoType === 'string' && VALID_TYPES.includes(o.videoType as VideoType)) {
        f.videoType = o.videoType as VideoType;
      }
      if (
        Array.isArray(o.categoryIds) &&
        o.categoryIds.every((id) => typeof id === 'string')
      ) {
        f.categoryIds = o.categoryIds as string[];
      }
    }
    return getFlaggedVideos(f);
  });

  ipcMain.handle('channels:get-channel-videos', async (_event, channelId: unknown) => {
    if (typeof channelId !== 'string') throw new Error('channels:get-channel-videos expects a string id');
    return getChannelVideos(channelId);
  });

  ipcMain.handle('channels:backfill', async (_event, channelId: unknown) => {
    if (typeof channelId !== 'string') throw new Error('channels:backfill expects a string id');
    return backfillChannel(channelId);
  });

  ipcMain.handle('channels:list-update-runs', async (_event, limit: unknown) => {
    const n = typeof limit === 'number' ? limit : 10;
    return listUpdateRuns(n);
  });

  ipcMain.handle('channels:get-startup-action', async () => getStartupAction());

  ipcMain.handle('channels:dismiss-startup-suggestion', async () => {
    await dismissStartupSuggestion();
  });

  ipcMain.handle(
    'channels:analytics-timeseries',
    async (_event, metric: unknown, daysBack: unknown, categoryIds: unknown) => {
      if (
        typeof metric !== 'string' ||
        !VALID_METRICS.includes(metric as ChannelTimeSeriesMetric)
      ) {
        throw new Error(`Invalid metric: ${String(metric)}`);
      }
      const days = typeof daysBack === 'number' && daysBack > 0 ? daysBack : 30;
      const ids =
        Array.isArray(categoryIds) && categoryIds.every((id) => typeof id === 'string')
          ? (categoryIds as string[])
          : [];
      return getChannelsTimeSeries(metric as ChannelTimeSeriesMetric, days, ids);
    }
  );

  ipcMain.handle('channels:analytics-evergreen', async (_event, filters: unknown) => {
    const f: EvergreenFilters = {};
    if (filters && typeof filters === 'object') {
      const o = filters as Record<string, unknown>;
      if (typeof o.channelId === 'string') f.channelId = o.channelId;
      if (typeof o.minAgeDays === 'number') f.minAgeDays = o.minAgeDays;
      if (typeof o.lookbackDays === 'number') f.lookbackDays = o.lookbackDays;
      if (typeof o.minViewsPerDay === 'number') f.minViewsPerDay = o.minViewsPerDay;
      if (typeof o.videoType === 'string' && VALID_TYPES.includes(o.videoType as VideoType)) {
        f.videoType = o.videoType as VideoType;
      }
      if (
        typeof o.sort === 'string' &&
        ['viewsPerDay', 'totalViews', 'newest', 'oldest'].includes(o.sort)
      ) {
        f.sort = o.sort as EvergreenFilters['sort'];
      }
      if (typeof o.titleQuery === 'string') f.titleQuery = o.titleQuery;
      if (typeof o.minConsecutiveAboveAverage === 'number') {
        f.minConsecutiveAboveAverage = o.minConsecutiveAboveAverage;
      }
      if (
        Array.isArray(o.categoryIds) &&
        o.categoryIds.every((id) => typeof id === 'string')
      ) {
        f.categoryIds = o.categoryIds as string[];
      }
    }
    return getEvergreenVideos(f);
  });

  ipcMain.handle('channels:analytics-evergreen-readiness', async () =>
    getEvergreenReadiness()
  );
}
