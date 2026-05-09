import { getPrisma } from '../../db';
import type {
  ChannelTimeSeriesMetric,
  ChannelTimeSeriesPayload,
  EvergreenFilters,
  EvergreenVideo,
} from '@shared/types';

const DEFAULT_DAYS = 30;
const DEFAULT_EVERGREEN_MIN_AGE_DAYS = 30;
const DEFAULT_EVERGREEN_LOOKBACK_DAYS = 30;

// =============================================================================
// Channel time series — drives the comparative charts
// =============================================================================

/**
 * Returns a multi-channel time series for one of three metrics. Each series is
 * the raw snapshot data for one channel, so the renderer can plot N lines on
 * one chart without joining anything client-side.
 *
 * For "viewsPerDay" we don't return a snapshot value — we return the *delta*
 * between consecutive snapshots' totalViewCount, normalized to views/day. So
 * each point represents the daily view-acquisition rate at that point.
 */
export async function getChannelsTimeSeries(
  metric: ChannelTimeSeriesMetric,
  daysBack = DEFAULT_DAYS,
  categoryIds: string[] = []
): Promise<ChannelTimeSeriesPayload> {
  const prisma = getPrisma();
  const since = new Date(Date.now() - daysBack * 86_400_000);

  const channels = await prisma.channel.findMany({
    where: {
      deletedAt: null,
      monitored: true,
      ...(categoryIds.length > 0
        ? { categories: { some: { categoryId: { in: categoryIds } } } }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
    include: {
      snapshots: {
        where: { deletedAt: null, takenAt: { gte: since } },
        orderBy: { takenAt: 'asc' },
        select: {
          takenAt: true,
          subscriberCount: true,
          totalViewCount: true,
          videoCount: true,
        },
      },
    },
  });

  const series = channels.map((c) => {
    if (metric === 'viewsPerDay') {
      const points: { date: string; value: number | null }[] = [];
      for (let i = 1; i < c.snapshots.length; i++) {
        const prev = c.snapshots[i - 1]!;
        const curr = c.snapshots[i]!;
        const prevViews = prev.totalViewCount;
        const currViews = curr.totalViewCount;
        if (prevViews === null || currViews === null) {
          points.push({ date: curr.takenAt.toISOString(), value: null });
          continue;
        }
        const elapsedDays =
          (curr.takenAt.getTime() - prev.takenAt.getTime()) / 86_400_000;
        if (elapsedDays <= 0) {
          points.push({ date: curr.takenAt.toISOString(), value: null });
          continue;
        }
        points.push({
          date: curr.takenAt.toISOString(),
          value: Math.round((currViews - prevViews) / elapsedDays),
        });
      }
      return {
        channelId: c.id,
        channelTitle: c.title,
        thumbnailUrl: c.thumbnailUrl,
        points,
      };
    }

    return {
      channelId: c.id,
      channelTitle: c.title,
      thumbnailUrl: c.thumbnailUrl,
      points: c.snapshots.map((s) => ({
        date: s.takenAt.toISOString(),
        value:
          metric === 'totalViews'
            ? s.totalViewCount
            : metric === 'subscribers'
              ? s.subscriberCount
              : null,
      })),
    };
  });

  return { metric, daysBack, series };
}

// =============================================================================
// Evergreen videos — videos still gaining views over time
// =============================================================================

/**
 * For each video, compute its average daily view delta over a recent window
 * (default 30 days). A video is "evergreen" if it's old enough (default >30
 * days since publish) and its viewsPerDay is meaningful (default ≥10/day).
 *
 * Implementation: for each video, find the oldest snapshot within the window
 * and compare to the most recent snapshot. Delta / elapsed days = viewsPerDay.
 * Falls back to (currentViews - 0)/ageInDays if there's only one snapshot
 * (gives a coarse all-time average).
 */
export async function getEvergreenVideos(
  filters: EvergreenFilters = {}
): Promise<EvergreenVideo[]> {
  const prisma = getPrisma();
  const minAgeDays = filters.minAgeDays ?? DEFAULT_EVERGREEN_MIN_AGE_DAYS;
  const lookbackDays = filters.lookbackDays ?? DEFAULT_EVERGREEN_LOOKBACK_DAYS;
  const minViewsPerDay = filters.minViewsPerDay ?? 10;
  const sinceWindow = new Date(Date.now() - lookbackDays * 86_400_000);
  const maxPublishedAt = new Date(Date.now() - minAgeDays * 86_400_000);

  const videos = await prisma.video.findMany({
    where: {
      deletedAt: null,
      publishedAt: { lte: maxPublishedAt },
      ...(filters.channelId ? { channelId: filters.channelId } : {}),
      ...(filters.categoryIds && filters.categoryIds.length > 0
        ? {
            channel: {
              categories: { some: { categoryId: { in: filters.categoryIds } } },
            },
          }
        : {}),
    },
    include: {
      channel: { select: { title: true } },
      snapshots: {
        where: { deletedAt: null, takenAt: { gte: sinceWindow } },
        orderBy: { takenAt: 'asc' },
        select: { takenAt: true, viewCount: true },
      },
    },
    take: 500,
  });

  const evergreen: EvergreenVideo[] = [];
  const now = Date.now();

  for (const v of videos) {
    let viewsPerDay: number | null = null;
    let basedOn: 'window' | 'all-time' = 'window';

    if (v.snapshots.length >= 2) {
      const first = v.snapshots[0]!;
      const last = v.snapshots[v.snapshots.length - 1]!;
      const delta = last.viewCount - first.viewCount;
      const elapsedDays =
        (last.takenAt.getTime() - first.takenAt.getTime()) / 86_400_000;
      if (elapsedDays > 0) {
        viewsPerDay = delta / elapsedDays;
      }
    } else {
      // Fall back to all-time average until we accumulate snapshots.
      const ageDays = (now - v.publishedAt.getTime()) / 86_400_000;
      if (ageDays > 0) {
        viewsPerDay = v.viewCount / ageDays;
        basedOn = 'all-time';
      }
    }

    if (viewsPerDay === null || viewsPerDay < minViewsPerDay) continue;

    evergreen.push({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      channelId: v.channelId,
      channelTitle: v.channel?.title ?? '',
      publishedAt: v.publishedAt.toISOString(),
      totalViewCount: v.viewCount,
      viewsPerDay: Math.round(viewsPerDay),
      basedOn,
      snapshotCount: v.snapshots.length,
    });
  }

  evergreen.sort((a, b) => b.viewsPerDay - a.viewsPerDay);
  return evergreen.slice(0, 100);
}
