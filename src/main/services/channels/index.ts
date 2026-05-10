import { getPrisma } from '../../db';
import { getSetting, setSetting } from '../settings';
import { YouTubeMockProvider } from './providers/youtube-mock';
import { YouTubeRealProvider } from './providers/youtube-real';
import type { ChannelProvider } from './providers/types';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import { assessOutliers } from './outlier';
import { setChannelCategories } from '../categories';
import type {
  AddChannelResult,
  ChannelInfo,
  FlaggedVideosFilters,
  StartupAction,
  UpdateRunInfo,
  VideoInfo,
  VideoType,
} from '@shared/types';

/**
 * Resolve the active YouTube channel provider:
 *   - real (YouTube Data API v3) when the user has a valid key
 *   - mock fallback (deterministic fake data) when not configured —
 *     useful so the rest of the app keeps working even before the user
 *     cadastrates a real key. UI layer is responsible for steering the
 *     user toward configuring a real key (Option A from Phase 8 plan).
 */
async function getProvider(): Promise<ChannelProvider> {
  const status = await getCredentialStatus('youtube');
  if (status?.status === 'valid' && status.hasValue) {
    const key = await getCredentialPlainText('youtube');
    if (key) return new YouTubeRealProvider(key);
  }
  return new YouTubeMockProvider();
}

export async function isYouTubeConfigured(): Promise<boolean> {
  const status = await getCredentialStatus('youtube');
  return Boolean(status?.status === 'valid' && status.hasValue);
}

const DEFAULT_THRESHOLD_PERCENT = 150;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_SUGGEST_AFTER_HOURS = 24;
const SUGGESTION_DISMISSED_KEY = 'channels.suggestion_dismissed_until';
const THRESHOLD_KEY = 'channels.outlier_threshold_percent';
const LOOKBACK_KEY = 'channels.lookback_days';

// =============================================================================
// CRUD
// =============================================================================

export async function addChannel(
  urlOrId: string,
  categoryIds: string[] = []
): Promise<AddChannelResult> {
  const trimmed = urlOrId.trim();
  if (!trimmed) {
    return { success: false, message: 'Informe uma URL ou ID de canal.' };
  }

  if (!(await isYouTubeConfigured())) {
    return {
      success: false,
      message:
        'YouTube Data API key não configurada ou inválida. Vá em Configurações → YouTube Data API e cadastre + valide sua chave.',
    };
  }

  const provider = await getProvider();
  let fetched;
  try {
    fetched = await provider.lookupChannel(trimmed);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha ao buscar canal.',
    };
  }

  const prisma = getPrisma();

  // Reactivate if previously soft-deleted.
  const existing = await prisma.channel.findUnique({
    where: { youtubeId: fetched.youtubeId },
  });

  const channel = existing
    ? await prisma.channel.update({
        where: { id: existing.id },
        data: {
          title: fetched.title,
          thumbnailUrl: fetched.thumbnailUrl,
          subscriberCount: fetched.subscriberCount,
          videoCount: fetched.videoCount,
          totalViewCount: fetched.totalViewCount,
          monitored: true,
          deletedAt: null,
        },
      })
    : await prisma.channel.create({
        data: {
          youtubeId: fetched.youtubeId,
          title: fetched.title,
          thumbnailUrl: fetched.thumbnailUrl,
          subscriberCount: fetched.subscriberCount,
          videoCount: fetched.videoCount,
          totalViewCount: fetched.totalViewCount,
        },
      });

  // First snapshot — gives us a starting point for the analytics charts.
  await prisma.channelSnapshot.create({
    data: {
      channelId: channel.id,
      subscriberCount: fetched.subscriberCount,
      totalViewCount: fetched.totalViewCount,
      videoCount: fetched.videoCount,
    },
  });

  if (categoryIds.length > 0) {
    await setChannelCategories(channel.id, categoryIds);
  }

  // First sync: ingest the entire upload catalog so the evergreen detector
  // has full history to work with. Cheap path via uploads playlist (1 unit
  // per 50 videos). Failure here doesn't block the channel from being
  // registered — user can re-trigger via "Atualizar agora".
  let firstSyncCount = 0;
  let firstSyncError: string | null = null;
  try {
    const result = await ingestAllVideosForChannel(channel.id, channel.youtubeId, provider);
    firstSyncCount = result.ingested;
    await prisma.channel.update({
      where: { id: channel.id },
      data: { lastUpdatedAt: new Date() },
    });
  } catch (err) {
    firstSyncError = err instanceof Error ? err.message : String(err);
  }

  return {
    success: true,
    message:
      (existing ? 'Canal reativado. ' : 'Canal cadastrado. ') +
      (firstSyncError
        ? `Sync inicial falhou (${firstSyncError}). Use "Atualizar agora" pra tentar de novo.`
        : `${firstSyncCount} vídeo${firstSyncCount === 1 ? '' : 's'} sincronizado${firstSyncCount === 1 ? '' : 's'}.`),
    channel: await projectChannel(channel.id),
  };
}

/**
 * Fetch every video from a channel's uploads playlist and persist them with
 * an initial snapshot each. Used at channel-add time and as a recovery path.
 *
 * Soft-deleted videos are SKIPPED — the user explicitly removed them from
 * monitoring; we don't resurrect them on subsequent syncs.
 */
async function ingestAllVideosForChannel(
  channelDbId: string,
  channelYoutubeId: string,
  provider: ChannelProvider
): Promise<{ ingested: number; skippedDeleted: number }> {
  const fetched = await provider.listAllVideos(channelYoutubeId);
  if (fetched.length === 0) return { ingested: 0, skippedDeleted: 0 };
  const prisma = getPrisma();

  let ingested = 0;
  let skippedDeleted = 0;

  for (const v of fetched) {
    const existing = await prisma.video.findUnique({
      where: { youtubeId: v.youtubeId },
    });

    if (existing?.deletedAt) {
      skippedDeleted += 1;
      continue;
    }

    let videoRecordId: string;
    if (existing) {
      await prisma.video.update({
        where: { id: existing.id },
        data: {
          channelId: channelDbId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          durationSec: v.durationSec,
          publishedAt: new Date(v.publishedAt),
        },
      });
      videoRecordId = existing.id;
    } else {
      const created = await prisma.video.create({
        data: {
          youtubeId: v.youtubeId,
          channelId: channelDbId,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          commentCount: v.commentCount,
          durationSec: v.durationSec,
          publishedAt: new Date(v.publishedAt),
        },
      });
      videoRecordId = created.id;
    }
    ingested += 1;

    await prisma.videoSnapshot.create({
      data: {
        videoId: videoRecordId,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
      },
    });
  }

  return { ingested, skippedDeleted };
}

/**
 * Public backfill: re-runs the full-catalog ingest for an existing channel.
 * Used by the renderer's "Sincronizar histórico completo" button — channels
 * registered before the full-sync change only have the last 30 days of videos.
 */
export async function backfillChannel(channelId: string): Promise<{
  success: boolean;
  message: string;
  ingested: number;
  skippedDeleted: number;
}> {
  if (!(await isYouTubeConfigured())) {
    return {
      success: false,
      message: 'YouTube Data API key não configurada ou inválida.',
      ingested: 0,
      skippedDeleted: 0,
    };
  }
  const channel = await getPrisma().channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.deletedAt) {
    return { success: false, message: 'Canal não encontrado.', ingested: 0, skippedDeleted: 0 };
  }
  const provider = await getProvider();
  try {
    const { ingested, skippedDeleted } = await ingestAllVideosForChannel(
      channel.id,
      channel.youtubeId,
      provider
    );
    await getPrisma().channel.update({
      where: { id: channel.id },
      data: { lastUpdatedAt: new Date() },
    });
    return {
      success: true,
      message:
        `${ingested} vídeo${ingested === 1 ? '' : 's'} sincronizado${ingested === 1 ? '' : 's'}` +
        (skippedDeleted > 0
          ? ` (${skippedDeleted} excluído${skippedDeleted === 1 ? '' : 's'} ignorado${skippedDeleted === 1 ? '' : 's'})`
          : '') +
        '.',
      ingested,
      skippedDeleted,
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
      ingested: 0,
      skippedDeleted: 0,
    };
  }
}

export async function removeChannel(channelId: string): Promise<void> {
  await getPrisma().channel.update({
    where: { id: channelId },
    data: { monitored: false, deletedAt: new Date() },
  });
}

export async function removeChannels(channelIds: string[]): Promise<number> {
  if (channelIds.length === 0) return 0;
  const result = await getPrisma().channel.updateMany({
    where: { id: { in: channelIds }, deletedAt: null },
    data: { monitored: false, deletedAt: new Date() },
  });
  return result.count;
}

export async function removeAllChannelsAndVideos(): Promise<{
  channels: number;
  videos: number;
}> {
  const prisma = getPrisma();
  const now = new Date();

  // Soft delete every non-deleted video, then every non-deleted channel.
  // updateMany makes this a single round-trip per table.
  const videosResult = await prisma.video.updateMany({
    where: { deletedAt: null },
    data: { deletedAt: now },
  });
  const channelsResult = await prisma.channel.updateMany({
    where: { deletedAt: null },
    data: { deletedAt: now, monitored: false },
  });

  return {
    channels: channelsResult.count,
    videos: videosResult.count,
  };
}

export async function listChannels(filters?: {
  categoryIds?: string[];
}): Promise<ChannelInfo[]> {
  const channels = await getPrisma().channel.findMany({
    where: {
      deletedAt: null,
      monitored: true,
      ...(filters?.categoryIds && filters.categoryIds.length > 0
        ? { categories: { some: { categoryId: { in: filters.categoryIds } } } }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
  });
  return Promise.all(channels.map((c) => projectChannel(c.id, c)));
}

async function projectChannel(
  id: string,
  preloaded?: Awaited<ReturnType<typeof getPrisma>['channel']['findUnique']>
): Promise<ChannelInfo> {
  const prisma = getPrisma();
  const c =
    preloaded ?? (await prisma.channel.findUniqueOrThrow({ where: { id } }));

  const lookbackDays = await getLookbackDays();
  const since = new Date(Date.now() - lookbackDays * 86_400_000);

  const [videoCountTracked, flaggedCount, recentAgg, categoryRows] = await Promise.all([
    prisma.video.count({ where: { channelId: id, deletedAt: null } }),
    prisma.video.count({
      where: { channelId: id, deletedAt: null, flaggedAsOutlier: true },
    }),
    prisma.video.aggregate({
      where: {
        channelId: id,
        deletedAt: null,
        publishedAt: { gte: since },
      },
      _avg: { viewCount: true },
      _count: { _all: true },
    }),
    prisma.channelCategory.findMany({
      where: { channelId: id, category: { deletedAt: null } },
      include: { category: { select: { id: true, name: true, color: true } } },
      orderBy: { category: { name: 'asc' } },
    }),
  ]);

  const recentAverageViews =
    recentAgg._avg.viewCount !== null && recentAgg._avg.viewCount !== undefined
      ? Math.round(recentAgg._avg.viewCount)
      : null;

  return {
    id: c.id,
    youtubeId: c.youtubeId,
    title: c.title,
    thumbnailUrl: c.thumbnailUrl,
    subscriberCount: c.subscriberCount,
    videoCount: c.videoCount,
    totalViewCount: c.totalViewCount,
    monitored: c.monitored,
    lastUpdatedAt: c.lastUpdatedAt?.toISOString() ?? null,
    videoCountTracked,
    flaggedCount,
    recentAverageViews,
    recentVideoCount: recentAgg._count._all,
    lookbackDays,
    categories: categoryRows.map((cc) => ({
      id: cc.category.id,
      name: cc.category.name,
      color: cc.category.color,
    })),
  };
}

// =============================================================================
// Settings (threshold + lookback)
// =============================================================================

export async function getOutlierThreshold(): Promise<number> {
  const v = await getSetting(THRESHOLD_KEY);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD_PERCENT;
}

export async function getLookbackDays(): Promise<number> {
  const v = await getSetting(LOOKBACK_KEY);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOOKBACK_DAYS;
}

export async function setOutlierThreshold(percent: number): Promise<void> {
  if (!Number.isFinite(percent) || percent < 100) {
    throw new Error('Threshold deve ser ≥ 100%.');
  }
  await setSetting(THRESHOLD_KEY, String(percent));
}

export async function setLookbackDays(days: number): Promise<void> {
  if (!Number.isFinite(days) || days < 1) {
    throw new Error('Lookback deve ser ≥ 1 dia.');
  }
  await setSetting(LOOKBACK_KEY, String(days));
}

// =============================================================================
// Update runs
// =============================================================================

export async function runUpdateAll(
  triggeredBy: 'manual' | 'scheduled' | 'startup'
): Promise<UpdateRunInfo> {
  const prisma = getPrisma();

  const channels = await prisma.channel.findMany({
    where: { deletedAt: null, monitored: true },
  });

  const thresholdPercent = await getOutlierThreshold();

  const run = await prisma.updateRun.create({
    data: {
      triggeredBy,
      channelsTotal: channels.length,
      status: 'running',
    },
  });

  // Bail out early if no real YouTube key is configured — there's nothing
  // useful we can do (mocks would just regenerate fake data over real channels).
  if (channels.length > 0 && !(await isYouTubeConfigured())) {
    const updated = await prisma.updateRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: 'failed',
        errorMessage:
          'YouTube Data API key não configurada ou inválida. Configure em Configurações.',
      },
    });
    return projectUpdateRun(updated);
  }

  const provider = await getProvider();

  let success = 0;
  let failed = 0;
  let videosNew = 0;
  let videosFlagged = 0;
  let firstError: string | null = null;

  for (const channel of channels) {
    try {
      // 1) Refresh channel-level stats (subs, total views) — 1 quota unit.
      //    Failure here doesn't abort the video update; we still want videos
      //    ingested even if the channel envelope failed transiently.
      let channelSnapshotStats: {
        subscriberCount: number | null;
        totalViewCount: number | null;
        videoCount: number | null;
      } | null = null;
      try {
        const refreshed = await provider.lookupChannel(channel.youtubeId);
        channelSnapshotStats = {
          subscriberCount: refreshed.subscriberCount,
          totalViewCount: refreshed.totalViewCount,
          videoCount: refreshed.videoCount,
        };
        await prisma.channel.update({
          where: { id: channel.id },
          data: {
            subscriberCount: refreshed.subscriberCount,
            totalViewCount: refreshed.totalViewCount,
            videoCount: refreshed.videoCount,
            thumbnailUrl: refreshed.thumbnailUrl,
            title: refreshed.title,
          },
        });
      } catch {
        /* keep going — re-snapshot of stored videos is the important part */
      }

      // 2) Discover NEW videos since last update. Bootstrapped channels get
      //    `lastUpdatedAt` from the first sync; never-synced channels fall
      //    back to a 90-day window so we don't pull the entire backlog twice.
      const since = channel.lastUpdatedAt ?? new Date(Date.now() - 90 * 86_400_000);
      let newVideos: Awaited<ReturnType<typeof provider.listAllVideos>> = [];
      try {
        newVideos = await provider.listAllVideos(channel.youtubeId, { since });
      } catch {
        /* tolerate — re-snapshot path below still runs */
      }

      for (const v of newVideos) {
        const existing = await prisma.video.findUnique({
          where: { youtubeId: v.youtubeId },
        });
        // Respect explicit user deletion — never resurrect soft-deleted videos.
        if (existing?.deletedAt) continue;
        if (existing) {
          await prisma.video.update({
            where: { id: existing.id },
            data: {
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              viewCount: v.viewCount,
              likeCount: v.likeCount,
              commentCount: v.commentCount,
              durationSec: v.durationSec,
              publishedAt: new Date(v.publishedAt),
            },
          });
        } else {
          await prisma.video.create({
            data: {
              youtubeId: v.youtubeId,
              channelId: channel.id,
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              viewCount: v.viewCount,
              likeCount: v.likeCount,
              commentCount: v.commentCount,
              durationSec: v.durationSec,
              publishedAt: new Date(v.publishedAt),
            },
          });
          videosNew += 1;
        }
      }

      // 3) Re-snapshot ALL stored videos for this channel (cheap: ~1 unit per
      //    50 videos). This is what the evergreen detector reads — we need a
      //    fresh data point per update for every video, not just new ones.
      const storedVideos = await prisma.video.findMany({
        where: { channelId: channel.id, deletedAt: null },
        select: { id: true, youtubeId: true },
      });

      if (storedVideos.length > 0) {
        const idMap = new Map(storedVideos.map((v) => [v.youtubeId, v.id]));
        const stats = await provider.refreshVideoStats(
          storedVideos.map((v) => v.youtubeId)
        );

        for (const s of stats) {
          const dbId = idMap.get(s.youtubeId);
          if (!dbId) continue;
          // Only overwrite durationSec when the API returned a real value —
          // protects against transient API quirks unsetting good data.
          const updateData: {
            viewCount: number;
            likeCount: number | null;
            commentCount: number | null;
            durationSec?: number;
          } = {
            viewCount: s.viewCount,
            likeCount: s.likeCount,
            commentCount: s.commentCount,
          };
          if (s.durationSec !== null && s.durationSec > 0) {
            updateData.durationSec = s.durationSec;
          }
          await prisma.video.update({
            where: { id: dbId },
            data: updateData,
          });
          await prisma.videoSnapshot.create({
            data: {
              videoId: dbId,
              viewCount: s.viewCount,
              likeCount: s.likeCount,
              commentCount: s.commentCount,
              updateRunId: run.id,
            },
          });
        }
      }

      // 4) Channel snapshot.
      if (channelSnapshotStats) {
        await prisma.channelSnapshot.create({
          data: {
            channelId: channel.id,
            subscriberCount: channelSnapshotStats.subscriberCount,
            totalViewCount: channelSnapshotStats.totalViewCount,
            videoCount: channelSnapshotStats.videoCount,
          },
        });
      }

      // 5) Persistent outlier flag — used by 🔥 badges shown on video cards
      //    across the app (Evergreen, channel detail, etc). Computed against
      //    a fixed 30-day window for visual consistency. The "Vídeos em
      //    destaque" tab does its own dynamic-window calculation per request,
      //    so this flag is only the default-window snapshot.
      const FLAG_WINDOW_DAYS = 30;
      const sinceFlag = new Date(Date.now() - FLAG_WINDOW_DAYS * 86_400_000);

      // Reset flag on videos that fell out of the 30d window — they're no
      // longer "destaque" candidates.
      await prisma.video.updateMany({
        where: {
          channelId: channel.id,
          deletedAt: null,
          publishedAt: { lt: sinceFlag },
          flaggedAsOutlier: true,
        },
        data: { flaggedAsOutlier: false },
      });

      const recentChannelVideos = await prisma.video.findMany({
        where: {
          channelId: channel.id,
          deletedAt: null,
          publishedAt: { gte: sinceFlag },
        },
        select: { id: true, viewCount: true },
      });
      const assessment = assessOutliers(
        recentChannelVideos.map((v) => ({ id: v.id, viewCount: v.viewCount })),
        thresholdPercent
      );
      for (const f of assessment.flagged) {
        await prisma.video.update({
          where: { id: f.id },
          data: {
            channelAvgViewsAtCheck: f.channelAvgViewsAtCheck,
            outlierPercent: f.outlierPercent,
            flaggedAsOutlier: f.flaggedAsOutlier,
          },
        });
        if (f.flaggedAsOutlier) videosFlagged += 1;
      }

      await prisma.channel.update({
        where: { id: channel.id },
        data: { lastUpdatedAt: new Date() },
      });
      success += 1;
    } catch (err) {
      failed += 1;
      if (!firstError) {
        firstError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  const status: UpdateRunInfo['status'] =
    failed === 0 && success > 0
      ? 'success'
      : success > 0
        ? 'partial'
        : channels.length === 0
          ? 'success'
          : 'failed';

  const updated = await prisma.updateRun.update({
    where: { id: run.id },
    data: {
      completedAt: new Date(),
      status,
      channelsSuccessful: success,
      channelsFailed: failed,
      videosNew,
      videosFlagged,
      errorMessage: firstError,
    },
  });

  return projectUpdateRun(updated);
}

export async function listUpdateRuns(limit = 10): Promise<UpdateRunInfo[]> {
  const runs = await getPrisma().updateRun.findMany({
    where: { deletedAt: null },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
  return runs.map(projectUpdateRun);
}

function projectUpdateRun(run: {
  id: string;
  triggeredBy: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  channelsTotal: number;
  channelsSuccessful: number;
  channelsFailed: number;
  videosNew: number;
  videosFlagged: number;
  errorMessage: string | null;
}): UpdateRunInfo {
  return {
    id: run.id,
    triggeredBy: run.triggeredBy as UpdateRunInfo['triggeredBy'],
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    status: run.status as UpdateRunInfo['status'],
    channelsTotal: run.channelsTotal,
    channelsSuccessful: run.channelsSuccessful,
    channelsFailed: run.channelsFailed,
    videosNew: run.videosNew,
    videosFlagged: run.videosFlagged,
    errorMessage: run.errorMessage,
  };
}

// =============================================================================
// Video queries
// =============================================================================

/**
 * Outlier detection — DYNAMIC window edition.
 *
 * The cutoff is computed *fresh per request* using the same window the user
 * selected (default 30d). Each channel's average is calculated only across
 * its videos published within that same window — videos outside the window
 * are neither comparators nor candidates. This way, "destaque dos últimos 7
 * dias" really means "vídeo dos últimos 7 dias acima da média dos vídeos do
 * canal nos últimos 7 dias" — not against the channel's lifetime average.
 *
 * Per-channel scoping ensures small channels can have outliers (the average
 * adapts to that channel's typical performance).
 */
export async function getFlaggedVideos(
  filters: FlaggedVideosFilters = {}
): Promise<VideoInfo[]> {
  const prisma = getPrisma();
  const sinceDays = filters.sinceDays ?? 30;
  const minPercent = filters.minPercent ?? 150;
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  // IMPORTANT: the type filter (shorts/longs) is applied AFTER the baseline
  // is computed — otherwise a channel with few videos of the selected type
  // (but plenty mixed) would fail the < 3 baseline cutoff and silently drop
  // valid outliers. The baseline is "média do canal nessa janela", which
  // intentionally mixes shorts + longs.
  const allInWindow = await prisma.video.findMany({
    where: {
      deletedAt: null,
      publishedAt: { gte: since },
      ...(filters.channelId ? { channelId: filters.channelId } : {}),
      ...(filters.categoryIds && filters.categoryIds.length > 0
        ? {
            channel: {
              categories: { some: { categoryId: { in: filters.categoryIds } } },
            },
          }
        : {}),
    },
    include: { channel: { select: { title: true } } },
    take: 5000,
  });

  // Group by channel so each channel gets its own baseline.
  const byChannel = new Map<string, typeof allInWindow>();
  for (const v of allInWindow) {
    const list = byChannel.get(v.channelId) ?? [];
    list.push(v);
    byChannel.set(v.channelId, list);
  }

  type ScoredVideo = (typeof allInWindow)[number] & {
    _outlierPercent: number;
    _channelAvg: number;
  };
  const flagged: ScoredVideo[] = [];

  for (const [, channelVideos] of byChannel) {
    // Need at least 3 videos in the window to have a meaningful baseline.
    if (channelVideos.length < 3) continue;
    const totalViews = channelVideos.reduce((s, v) => s + v.viewCount, 0);
    const avg = totalViews / channelVideos.length;
    if (avg <= 0) continue;

    for (const v of channelVideos) {
      // Apply the type filter HERE — baseline already locked in above.
      if (!matchesVideoType(v.durationSec, filters.videoType)) continue;

      const pct = (v.viewCount / avg) * 100;
      if (pct >= minPercent) {
        flagged.push({ ...v, _outlierPercent: pct, _channelAvg: Math.round(avg) });
      }
    }
  }

  flagged.sort((a, b) => b._outlierPercent - a._outlierPercent);

  return flagged.slice(0, 200).map((v) => ({
    id: v.id,
    youtubeId: v.youtubeId,
    channelId: v.channelId,
    channelTitle: v.channel?.title,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    viewCount: v.viewCount,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    durationSec: v.durationSec,
    publishedAt: v.publishedAt.toISOString(),
    channelAvgViewsAtCheck: v._channelAvg,
    outlierPercent: v._outlierPercent,
    flaggedAsOutlier: true,
  }));
}

/**
 * YouTube Shorts are videos up to 3 minutes (180s) — current definition
 * since late 2024. Anything longer is treated as a "long-form" video.
 * Returns a Prisma where clause fragment, or an empty object for 'all'.
 *
 * 'unknown' targets videos with null/0 durationSec — typically premieres or
 * lives ingested in a window where YouTube returned P0D. Those auto-heal on
 * the next 'Atualizar agora' (refreshVideoStats now fetches contentDetails).
 */
const SHORTS_MAX_DURATION_SEC = 180;

function durationFilter(videoType: VideoType | undefined) {
  if (videoType === 'shorts') {
    return { durationSec: { lte: SHORTS_MAX_DURATION_SEC, gt: 0 } };
  }
  if (videoType === 'long') {
    return { durationSec: { gt: SHORTS_MAX_DURATION_SEC } };
  }
  if (videoType === 'unknown') {
    return { OR: [{ durationSec: null }, { durationSec: 0 }] };
  }
  return {};
}

/**
 * In-memory equivalent of `durationFilter` — used when we need to apply the
 * type filter AFTER pulling videos (e.g., outlier baseline must be computed
 * across all types before restricting the result set).
 */
function matchesVideoType(
  durationSec: number | null,
  videoType: VideoType | undefined
): boolean {
  if (!videoType || videoType === 'all') return true;
  if (videoType === 'shorts') {
    return durationSec !== null && durationSec > 0 && durationSec <= SHORTS_MAX_DURATION_SEC;
  }
  if (videoType === 'long') {
    return durationSec !== null && durationSec > SHORTS_MAX_DURATION_SEC;
  }
  if (videoType === 'unknown') {
    return durationSec === null || durationSec === 0;
  }
  return true;
}

export async function getChannelVideos(channelId: string): Promise<VideoInfo[]> {
  const videos = await getPrisma().video.findMany({
    where: { deletedAt: null, channelId },
    orderBy: { publishedAt: 'desc' },
    include: { channel: { select: { title: true } } },
  });
  return videos.map(projectVideo);
}

function projectVideo(v: {
  id: string;
  youtubeId: string;
  channelId: string;
  channel?: { title: string } | null;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  durationSec: number | null;
  publishedAt: Date;
  channelAvgViewsAtCheck: number | null;
  outlierPercent: number | null;
  flaggedAsOutlier: boolean;
}): VideoInfo {
  return {
    id: v.id,
    youtubeId: v.youtubeId,
    channelId: v.channelId,
    channelTitle: v.channel?.title,
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    viewCount: v.viewCount,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    durationSec: v.durationSec,
    publishedAt: v.publishedAt.toISOString(),
    channelAvgViewsAtCheck: v.channelAvgViewsAtCheck,
    outlierPercent: v.outlierPercent,
    flaggedAsOutlier: v.flaggedAsOutlier,
  };
}

// =============================================================================
// Startup action (drives the popup-on-open in the renderer)
// =============================================================================

export async function getStartupAction(): Promise<StartupAction> {
  const prisma = getPrisma();

  // 1) Missed schedule: active, not cancelled, not yet run, scheduledAt < now.
  const missed = await prisma.scheduledUpdate.findFirst({
    where: {
      deletedAt: null,
      active: true,
      cancelled: false,
      ranAt: null,
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
  });
  if (missed) {
    return {
      kind: 'missed-schedule',
      schedule: {
        id: missed.id,
        scheduledAt: missed.scheduledAt.toISOString(),
        active: missed.active,
        cancelled: missed.cancelled,
        ranAt: missed.ranAt?.toISOString() ?? null,
      },
    };
  }

  // 2) Suggest update if there are channels and last update is stale.
  const channelsCount = await prisma.channel.count({
    where: { deletedAt: null, monitored: true },
  });
  if (channelsCount === 0) return { kind: 'none' };

  const dismissedUntilStr = await getSetting(SUGGESTION_DISMISSED_KEY);
  if (dismissedUntilStr) {
    const dismissedUntil = new Date(dismissedUntilStr);
    if (Number.isFinite(dismissedUntil.getTime()) && dismissedUntil > new Date()) {
      return { kind: 'none' };
    }
  }

  const lastRun = await prisma.updateRun.findFirst({
    where: { deletedAt: null, status: { in: ['success', 'partial'] } },
    orderBy: { completedAt: 'desc' },
  });

  if (!lastRun || !lastRun.completedAt) {
    return { kind: 'suggest-update', lastRunAt: null, channelsCount };
  }

  const hoursSinceLast =
    (Date.now() - lastRun.completedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceLast < DEFAULT_SUGGEST_AFTER_HOURS) {
    return { kind: 'none' };
  }

  return {
    kind: 'suggest-update',
    lastRunAt: lastRun.completedAt.toISOString(),
    channelsCount,
  };
}

export async function dismissStartupSuggestion(): Promise<void> {
  // Snooze for ~12 hours so the popup doesn't reappear next time the user
  // opens the app the same day.
  const until = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await setSetting(SUGGESTION_DISMISSED_KEY, until.toISOString());
}
