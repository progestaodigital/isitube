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
 * Evergreen detection algorithm (per channel):
 *
 *   1. For each "Atualizar agora" run, every monitored video gets a snapshot
 *      tagged with that run id.
 *   2. For each video > 30 days old, compute views/day for each *interval*
 *      between consecutive snapshots: (delta_views / elapsed_days).
 *   3. For each interval, compute the channel's *average* views/day across
 *      all >30d videos in the same channel that have data for that interval.
 *      Each video's score = (its viewsPerDay / channel average) * 100%.
 *   4. A video is "evergreen" when its score > 100% in ≥ N consecutive most
 *      recent intervals (default 3).
 *
 * Why this design:
 *   - Self-calibrating per channel — small channel videos can be evergreen.
 *   - Multi-interval requirement filters out hype/spike videos (a viral
 *     polemic video might pop one update but won't sustain across 3+).
 *   - No magic absolute view threshold (configurable but not required).
 */
export async function getEvergreenVideos(
  filters: EvergreenFilters = {}
): Promise<EvergreenVideo[]> {
  const prisma = getPrisma();
  const minAgeDays = filters.minAgeDays ?? DEFAULT_EVERGREEN_MIN_AGE_DAYS;
  const minConsecutive = filters.minConsecutiveAboveAverage ?? 3;
  const minViewsPerDay = filters.minViewsPerDay ?? 0; // 0 = no floor
  const maxPublishedAt = new Date(Date.now() - minAgeDays * 86_400_000);

  // 1) Pull every >30d video with its full snapshot timeline (only snapshots
  //    tied to an update run — backfill snapshots are baseline, not intervals).
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
        where: { deletedAt: null },
        orderBy: { takenAt: 'asc' },
        select: { takenAt: true, viewCount: true, updateRunId: true },
      },
    },
    take: 2000,
  });

  // 2) Compute per-video interval series: views/day for each gap between
  //    consecutive snapshots. We index intervals by the END snapshot's
  //    updateRunId — that's the run that "owns" this delta.
  type IntervalPoint = { runId: string | null; viewsPerDay: number; takenAt: Date };
  type VideoWithIntervals = {
    raw: (typeof videos)[number];
    intervals: IntervalPoint[];
  };

  const byChannel = new Map<string, VideoWithIntervals[]>();

  for (const v of videos) {
    if (v.snapshots.length < 2) continue;
    const intervals: IntervalPoint[] = [];
    for (let i = 1; i < v.snapshots.length; i++) {
      const prev = v.snapshots[i - 1]!;
      const curr = v.snapshots[i]!;
      const elapsedDays = (curr.takenAt.getTime() - prev.takenAt.getTime()) / 86_400_000;
      if (elapsedDays <= 0) continue;
      const delta = curr.viewCount - prev.viewCount;
      // Negative delta (e.g., YouTube view-count adjustment) → treat as 0.
      const viewsPerDay = Math.max(0, delta / elapsedDays);
      intervals.push({
        runId: curr.updateRunId,
        viewsPerDay,
        takenAt: curr.takenAt,
      });
    }
    if (intervals.length === 0) continue;

    const list = byChannel.get(v.channelId) ?? [];
    list.push({ raw: v, intervals });
    byChannel.set(v.channelId, list);
  }

  // 3) For each channel, compute per-run average views/day across its videos,
  //    then percent for each video per interval, then evaluate the "consecutive
  //    above average" condition.
  const evergreen: EvergreenVideo[] = [];

  for (const [, channelVideos] of byChannel) {
    // Collect all run ids represented in this channel's intervals.
    const runIdsSet = new Set<string>();
    for (const cv of channelVideos) {
      for (const iv of cv.intervals) {
        if (iv.runId) runIdsSet.add(iv.runId);
      }
    }
    // Order runs chronologically using the earliest takenAt seen for that runId.
    const runOrder: { runId: string; takenAt: Date }[] = [];
    for (const runId of runIdsSet) {
      let earliest: Date | null = null;
      for (const cv of channelVideos) {
        for (const iv of cv.intervals) {
          if (iv.runId === runId && (!earliest || iv.takenAt < earliest)) {
            earliest = iv.takenAt;
          }
        }
      }
      if (earliest) runOrder.push({ runId, takenAt: earliest });
    }
    runOrder.sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());

    // Per run: channel average across the videos that have data for that run.
    const channelAvgPerRun = new Map<string, number>();
    for (const { runId } of runOrder) {
      const values: number[] = [];
      for (const cv of channelVideos) {
        const iv = cv.intervals.find((x) => x.runId === runId);
        if (iv) values.push(iv.viewsPerDay);
      }
      if (values.length > 0) {
        const avg = values.reduce((s, n) => s + n, 0) / values.length;
        channelAvgPerRun.set(runId, avg);
      }
    }

    // Now score each video against the channel averages.
    for (const cv of channelVideos) {
      // Build per-run % scores in chronological order.
      const scores: { runId: string; pct: number; viewsPerDay: number }[] = [];
      for (const { runId } of runOrder) {
        const iv = cv.intervals.find((x) => x.runId === runId);
        const avg = channelAvgPerRun.get(runId);
        if (!iv || avg === undefined || avg === 0) continue;
        scores.push({
          runId,
          pct: (iv.viewsPerDay / avg) * 100,
          viewsPerDay: iv.viewsPerDay,
        });
      }
      if (scores.length === 0) continue;

      // Walk from the most recent score backwards, count consecutive >100%.
      let consecutive = 0;
      for (let i = scores.length - 1; i >= 0; i--) {
        if (scores[i]!.pct > 100) consecutive += 1;
        else break;
      }

      const recent = scores.slice(-Math.max(minConsecutive, 5));
      const lastViewsPerDay = scores[scores.length - 1]?.viewsPerDay ?? 0;

      // Apply optional absolute floor — useful to drop micro-channels with
      // noisy 1-views-vs-0-average ratios.
      if (lastViewsPerDay < minViewsPerDay) continue;

      const isEvergreen = consecutive >= minConsecutive;
      if (!isEvergreen) continue;

      evergreen.push({
        id: cv.raw.id,
        youtubeId: cv.raw.youtubeId,
        title: cv.raw.title,
        thumbnailUrl: cv.raw.thumbnailUrl,
        channelId: cv.raw.channelId,
        channelTitle: cv.raw.channel?.title ?? '',
        publishedAt: cv.raw.publishedAt.toISOString(),
        totalViewCount: cv.raw.viewCount,
        viewsPerDay: Math.round(lastViewsPerDay),
        consecutiveAboveAverage: consecutive,
        recentPercentages: recent.map((r) => Math.round(r.pct)),
        // Legacy fields for backwards compat with current UI:
        basedOn: 'window',
        snapshotCount: cv.raw.snapshots.length,
      });
    }
  }

  // Sort by sustained advantage: longest streak first, ties broken by recent %.
  evergreen.sort((a, b) => {
    if (b.consecutiveAboveAverage !== a.consecutiveAboveAverage) {
      return b.consecutiveAboveAverage - a.consecutiveAboveAverage;
    }
    const aLast = a.recentPercentages[a.recentPercentages.length - 1] ?? 0;
    const bLast = b.recentPercentages[b.recentPercentages.length - 1] ?? 0;
    return bLast - aLast;
  });

  // Apply explicit sort if user picked one.
  if (filters.sort === 'totalViews') {
    evergreen.sort((a, b) => b.totalViewCount - a.totalViewCount);
  } else if (filters.sort === 'newest') {
    evergreen.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  } else if (filters.sort === 'oldest') {
    evergreen.sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
  }

  // Apply title filter and video-type filter (kept here because the renderer
  // expects them to work via this same query path).
  let filtered = evergreen;
  if (filters.titleQuery) {
    const q = filters.titleQuery.toLowerCase();
    filtered = filtered.filter((v) => v.title.toLowerCase().includes(q));
  }

  return filtered.slice(0, 200);
}

/**
 * Diagnostic helper for the empty-state UI: tells the renderer how many
 * snapshot intervals exist per channel so we can show "need N more updates"
 * messaging instead of an opaque empty list.
 */
export async function getEvergreenReadiness(): Promise<{
  totalUpdateRuns: number;
  intervalsAvailable: number; // = totalRuns (each run after backfill creates one interval per video)
  minNeeded: number;
}> {
  const prisma = getPrisma();
  const runs = await prisma.updateRun.count({
    where: { deletedAt: null, status: { in: ['success', 'partial'] } },
  });
  return {
    totalUpdateRuns: runs,
    intervalsAvailable: runs, // each completed run creates 1 interval per video (vs. previous snapshot)
    minNeeded: 3,
  };
}
