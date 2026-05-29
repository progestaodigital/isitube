import { getPrisma } from '../../db';
import { getSetting, setSetting } from '../settings';
import { YouTubeMockProvider } from './providers/youtube-mock';
import { YouTubeRealProvider } from './providers/youtube-real';
import type { ChannelProvider } from './providers/types';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import { setChannelCategories } from '../categories';
import { getActiveLicenseKey, getActivePlan } from '../license';
import { YOUTUBE_PROXY_BASE_URL } from '../external/endpoints';
import { broadcastUpdateRunStarted } from './scheduler';
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
  const plan = await getActivePlan();

  if (plan === 'iniciante') {
    const licenseKey = await getActiveLicenseKey();
    if (licenseKey) {
      return new YouTubeRealProvider({
        mode: 'proxy',
        licenseKey,
        baseUrl: YOUTUBE_PROXY_BASE_URL,
      });
    }
    // Iniciante without a usable license key falls through to mock so the
    // UI doesn't crash; the gate modal should prevent this in practice.
    return new YouTubeMockProvider();
  }

  // Pro / BYOK — or no plan (mock fallback so dev/tests keep working).
  const status = await getCredentialStatus('youtube');
  if (status?.status === 'valid' && status.hasValue) {
    const key = await getCredentialPlainText('youtube');
    if (key) return new YouTubeRealProvider({ mode: 'direct', apiKey: key });
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

// Retenção de snapshots — VideoSnapshot é volumoso (1 por vídeo por update),
// ChannelSnapshot é leve (1 por canal por update). Mantemos VideoSnapshot
// por 90d (cobre baseline outlier de 30d + intervalos de evergreen) e
// ChannelSnapshot por 1 ano (cobre o maior range de charts: 180d).
const VIDEO_SNAPSHOT_RETENTION_DAYS = 90;
const CHANNEL_SNAPSHOT_RETENTION_DAYS = 365;

/**
 * Monta o patch de metadata pra prisma.video.create/update. Os campos vêm
 * do FetchedVideo ou VideoStatsUpdate (compatíveis no shape de metadata).
 * Só inclui campos que vieram do provider (não-nulos), pra não sobrescrever
 * com null se o provider não retornou.
 */
function metadataPatch(
  v: {
    description: string | null;
    tags: string[] | null;
    thumbnailHdUrl: string | null;
    language: string | null;
    category: string | null;
    liveBroadcastStatus: string | null;
  },
  extractedAt: Date
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    metadataExtractedAt: extractedAt,
  };
  if (v.description !== null) patch.description = v.description;
  if (v.tags !== null) patch.tags = JSON.stringify(v.tags);
  if (v.thumbnailHdUrl !== null) patch.thumbnailHdUrl = v.thumbnailHdUrl;
  if (v.language !== null) patch.language = v.language;
  if (v.category !== null) patch.category = v.category;
  if (v.liveBroadcastStatus !== null) patch.liveBroadcastStatus = v.liveBroadcastStatus;
  return patch;
}

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

  const now = new Date();
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
          // Metadata: só escreve se ainda não tinha sido extraída (respeita
          // extrações manuais já feitas e evita reescrever o que não mudou).
          ...(existing.metadataExtractedAt ? {} : metadataPatch(v, now)),
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
          ...metadataPatch(v, now),
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
 * Backfill all monitored channels in sequence. Returns a per-channel summary
 * so the UI can show progress and any failures.
 */
export async function backfillAllChannels(): Promise<{
  success: boolean;
  message: string;
  results: Array<{
    channelId: string;
    channelTitle: string;
    success: boolean;
    message: string;
    ingested: number;
    skippedDeleted: number;
  }>;
}> {
  if (!(await isYouTubeConfigured())) {
    return {
      success: false,
      message: 'YouTube Data API key não configurada ou inválida.',
      results: [],
    };
  }
  const channels = await getPrisma().channel.findMany({
    where: { deletedAt: null, monitored: true },
    select: { id: true, youtubeId: true, title: true },
    orderBy: { createdAt: 'asc' },
  });
  if (channels.length === 0) {
    return { success: true, message: 'Nenhum canal cadastrado.', results: [] };
  }

  const results: Array<{
    channelId: string;
    channelTitle: string;
    success: boolean;
    message: string;
    ingested: number;
    skippedDeleted: number;
  }> = [];

  let totalIngested = 0;
  let totalSkipped = 0;
  let failures = 0;

  for (const channel of channels) {
    const r = await backfillChannel(channel.id);
    results.push({
      channelId: channel.id,
      channelTitle: channel.title,
      success: r.success,
      message: r.message,
      ingested: r.ingested,
      skippedDeleted: r.skippedDeleted,
    });
    if (r.success) {
      totalIngested += r.ingested;
      totalSkipped += r.skippedDeleted;
    } else {
      failures += 1;
    }
  }

  return {
    success: failures === 0,
    message:
      `${channels.length} canais processados, ${totalIngested} vídeos sincronizados` +
      (totalSkipped > 0 ? `, ${totalSkipped} excluídos ignorados` : '') +
      (failures > 0 ? `, ${failures} falharam` : '') +
      '.',
    results,
  };
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

type ChannelRow = Awaited<ReturnType<ReturnType<typeof getPrisma>['channel']['findUnique']>>;

async function projectChannel(
  id: string,
  preloaded?: ChannelRow
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

  // Prisma agrega BigInt como Decimal/string em alguns drivers; aqui o _avg
  // já volta como number (Float). Mas o casting Number() é defensivo.
  const recentAverageViews =
    recentAgg._avg.viewCount !== null && recentAgg._avg.viewCount !== undefined
      ? Math.round(Number(recentAgg._avg.viewCount))
      : null;

  return {
    id: c.id,
    youtubeId: c.youtubeId,
    title: c.title,
    thumbnailUrl: c.thumbnailUrl,
    // BigInt → Number no boundary do IPC pra renderer trabalhar com number
    // normal. Valores até 2^53 são exatos como Number; YouTube não chega lá.
    subscriberCount: c.subscriberCount === null ? null : Number(c.subscriberCount),
    videoCount: c.videoCount,
    totalViewCount: c.totalViewCount === null ? null : Number(c.totalViewCount),
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

  // Sinaliza pro renderer que o run COMEÇOU. Importante pro UX: páginas
  // que precisam mostrar "atualizando..." podem subscrever ao evento global
  // em vez de depender do estado local do componente, que some quando o
  // usuário navega pra outra página durante o run.
  broadcastUpdateRunStarted(projectUpdateRun(run));

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

      const updateRunNow = new Date();
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
              ...(existing.metadataExtractedAt ? {} : metadataPatch(v, updateRunNow)),
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
              ...metadataPatch(v, updateRunNow),
            },
          });
          videosNew += 1;
        }
      }

      // 3) Re-snapshot ALL stored videos for this channel (cheap: ~1 unit per
      //    50 videos). This is what the evergreen detector reads — we need a
      //    fresh data point per update for every video, not just new ones.
      //    Bonus: refreshVideoStats traz description+tags+language no mesmo
      //    request (custo zero a mais de quota). Metadata só é gravada pra
      //    vídeos sem metadataExtractedAt (vídeos já extraídos manualmente
      //    ficam intactos).
      const storedVideos = await prisma.video.findMany({
        where: { channelId: channel.id, deletedAt: null },
        select: { id: true, youtubeId: true, metadataExtractedAt: true },
      });

      if (storedVideos.length > 0) {
        const idMap = new Map(
          storedVideos.map((v) => [v.youtubeId, { id: v.id, extracted: v.metadataExtractedAt }])
        );
        const stats = await provider.refreshVideoStats(
          storedVideos.map((v) => v.youtubeId)
        );

        for (const s of stats) {
          const entry = idMap.get(s.youtubeId);
          if (!entry) continue;
          const updateData: Record<string, unknown> = {
            viewCount: s.viewCount,
            likeCount: s.likeCount,
            commentCount: s.commentCount,
          };
          if (s.durationSec !== null && s.durationSec > 0) {
            updateData.durationSec = s.durationSec;
          }
          // Auto-extract metadata se ainda não foi extraída pra esse vídeo.
          if (!entry.extracted) {
            Object.assign(updateData, metadataPatch(s, updateRunNow));
          }
          await prisma.video.update({
            where: { id: entry.id },
            data: updateData,
          });
          await prisma.videoSnapshot.create({
            data: {
              videoId: entry.id,
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

      // 5) Persistent outlier flag — usado pelos badges 🔥 nos cards.
      //    Mesmo algoritmo do getFlaggedVideos (views/dia + média de ativos
      //    em janela fixa de 30d), pra que o badge bata com o que o usuário
      //    vê na aba "Vídeos em destaque" no filtro default.
      const sinceFlag = new Date(Date.now() - BASELINE_WINDOW_DAYS * 86_400_000);

      // Limpa o flag em todos os vídeos do canal — vai ser reaplicado abaixo
      // só nos que de fato qualificam. Resolve dois casos:
      //   - vídeos que saíram da janela de 30d
      //   - vídeos que estavam flagged mas perderam tração e não qualificam mais
      await prisma.video.updateMany({
        where: {
          channelId: channel.id,
          deletedAt: null,
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
        include: {
          snapshots: {
            where: { deletedAt: null, takenAt: { gte: sinceFlag } },
            orderBy: { takenAt: 'asc' },
            select: { takenAt: true, viewCount: true },
          },
        },
      });

      // Computa views/dia pra cada e separa os ativos.
      const withVpd = recentChannelVideos.map((v) => ({ video: v, vpd: viewsPerDay(v) }));
      const active = withVpd.filter((x) => x.vpd >= ACTIVE_FLOOR_VIEWS_PER_DAY);

      if (active.length >= BASELINE_MIN_ACTIVE) {
        const sumVpd = active.reduce((s, x) => s + x.vpd, 0);
        const avgVpd = sumVpd / active.length;

        if (avgVpd > 0) {
          for (const { video: v, vpd } of withVpd) {
            const pct = (vpd / avgVpd) * 100;
            const isOutlier = pct >= thresholdPercent;
            if (isOutlier) {
              await prisma.video.update({
                where: { id: v.id },
                data: {
                  channelAvgViewsAtCheck: Math.round(avgVpd),
                  outlierPercent: pct,
                  flaggedAsOutlier: true,
                },
              });
              videosFlagged += 1;
            }
          }
        }
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

  // Best-effort retention pass — não falha o update se a limpeza der erro.
  try {
    await cleanupOldSnapshots();
  } catch {
    /* swallow */
  }

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
 * Outlier detection — VIEWS/DIA + MEAN baseline (filtered) edition.
 *
 * Mental model: "destaque" = vídeo cuja velocidade de views/dia ultrapassa
 * por X% a velocidade típica do canal nos últimos 30 dias.
 *
 * Why views/dia (not total views): vídeos de idades diferentes têm acumulações
 * incomparáveis. 30k em 3 dias e 30k em 100 dias performam radicalmente
 * diferente. Normalizar por idade neutraliza isso.
 *
 * Why mean (not median): tentamos mediana antes — gerava discrepâncias muito
 * grandes nos cards (% acima da baseline ficava extremo demais visualmente).
 * Mean dos ativos suaviza as comparações, à custa de virais inflarem um pouco
 * a baseline. Trade-off aceito.
 *
 * Why fixed 30-day baseline (not user's filter window): canais low-frequency
 * (1 vídeo/semana) não teriam baseline confiável em janelas curtas.
 *
 * Why filter dead ones (< 1 view/dia): canais têm long tail de vídeos sem
 * tração que arrastam a média pra baixo. Filtrar evita que qualquer vídeo
 * minimamente ativo vire outlier.
 *
 * Per-channel scoping mantido (canal pequeno tem destaques).
 */
const BASELINE_WINDOW_DAYS = 30;
const BASELINE_MIN_ACTIVE = 3;
const ACTIVE_FLOOR_VIEWS_PER_DAY = 1; // < 1 = morto, fora da baseline

export async function getFlaggedVideos(
  filters: FlaggedVideosFilters = {}
): Promise<VideoInfo[]> {
  const prisma = getPrisma();
  const sinceDays = filters.sinceDays ?? 30;
  const minPercent = filters.minPercent ?? 150;
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const sinceBaseline = new Date(Date.now() - BASELINE_WINDOW_DAYS * 86_400_000);

  const channelFilter: Record<string, unknown> = {
    deletedAt: null,
    ...(filters.channelId ? { channelId: filters.channelId } : {}),
    ...(filters.categoryIds && filters.categoryIds.length > 0
      ? {
          channel: {
            categories: { some: { categoryId: { in: filters.categoryIds } } },
          },
        }
      : {}),
  };

  // 1) Baseline pool — sempre últimos 30 dias.
  const baselinePool = await prisma.video.findMany({
    where: { ...channelFilter, publishedAt: { gte: sinceBaseline } },
    include: {
      snapshots: {
        where: { deletedAt: null, takenAt: { gte: sinceBaseline } },
        orderBy: { takenAt: 'asc' },
        select: { takenAt: true, viewCount: true },
      },
    },
    take: 10000,
  });

  // 2) Display pool — janela do usuário.
  const displayPool = await prisma.video.findMany({
    where: { ...channelFilter, publishedAt: { gte: since } },
    include: {
      channel: { select: { title: true } },
      snapshots: {
        where: { deletedAt: null, takenAt: { gte: sinceBaseline } },
        orderBy: { takenAt: 'asc' },
        select: { takenAt: true, viewCount: true },
      },
    },
    take: 5000,
  });

  // 3) Mediana per channel (com fallback type → mixed).
  type ChannelBaseline = {
    avg: number;
    kind: 'type' | 'mixed';
    count: number;
  };
  const baselineByChannel = new Map<string, (typeof baselinePool)[number][]>();
  for (const v of baselinePool) {
    const list = baselineByChannel.get(v.channelId) ?? [];
    list.push(v);
    baselineByChannel.set(v.channelId, list);
  }

  const computedBaseline = new Map<string, ChannelBaseline>();
  for (const [channelId, channelVideos] of baselineByChannel) {
    // Computa views/dia ativo (≥ 1) pra cada vídeo.
    const allActive = channelVideos
      .map((v) => ({ video: v, vpd: viewsPerDay(v) }))
      .filter((x) => x.vpd >= ACTIVE_FLOOR_VIEWS_PER_DAY);

    const typedActive = allActive.filter((x) =>
      matchesVideoType(x.video.durationSec, filters.videoType)
    );

    let pool = typedActive;
    let kind: 'type' | 'mixed' = 'type';
    if (typedActive.length < BASELINE_MIN_ACTIVE) {
      if (allActive.length < BASELINE_MIN_ACTIVE) continue;
      pool = allActive;
      kind = 'mixed';
    }

    const sumVpd = pool.reduce((s, x) => s + x.vpd, 0);
    const avg = sumVpd / pool.length;
    if (avg <= 0) continue;

    computedBaseline.set(channelId, { avg, kind, count: pool.length });
  }

  // 4) Score do display pool contra a mediana do canal.
  type ScoredVideo = (typeof displayPool)[number] & {
    _outlierPercent: number;
    _channelAvg: number;
    _baselineKind: 'type' | 'mixed';
    _baselineCount: number;
    _viewsPerDay: number;
  };
  const flagged: ScoredVideo[] = [];

  for (const v of displayPool) {
    if (!matchesVideoType(v.durationSec, filters.videoType)) continue;
    const baseline = computedBaseline.get(v.channelId);
    if (!baseline) continue;

    const vpd = viewsPerDay(v);
    if (vpd <= 0) continue;

    const pct = (vpd / baseline.avg) * 100;
    if (pct >= minPercent) {
      flagged.push({
        ...v,
        _outlierPercent: pct,
        _channelAvg: Math.round(baseline.avg),
        _baselineKind: baseline.kind,
        _baselineCount: baseline.count,
        _viewsPerDay: Math.round(vpd),
      });
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
    viewCount: Number(v.viewCount),
    likeCount: v.likeCount,
    commentCount: v.commentCount,
    durationSec: v.durationSec,
    publishedAt: v.publishedAt.toISOString(),
    channelAvgViewsAtCheck: v._channelAvg, // média de views/dia entre vídeos ativos
    outlierPercent: v._outlierPercent,
    flaggedAsOutlier: true,
    baselineKind: v._baselineKind,
    baselineCount: v._baselineCount,
    viewsPerDay: v._viewsPerDay,
  }));
}

/**
 * Calcula views/dia recente do vídeo:
 *   - Se tem ≥ 2 snapshots no período: delta entre primeiro e último ÷ dias decorridos
 *   - Senão: views_totais ÷ idade_em_dias (lifetime, fallback até acumular snapshots)
 */
function viewsPerDay(v: {
  // Prisma retorna BigInt pra view_count desde a migração de widen.
  // Aceita number também (caller pode estar passando já convertido).
  viewCount: number | bigint;
  publishedAt: Date;
  snapshots: { takenAt: Date; viewCount: number | bigint }[];
}): number {
  if (v.snapshots.length >= 2) {
    const first = v.snapshots[0]!;
    const last = v.snapshots[v.snapshots.length - 1]!;
    const elapsedDays = (last.takenAt.getTime() - first.takenAt.getTime()) / 86_400_000;
    if (elapsedDays > 0) {
      return Math.max(0, (Number(last.viewCount) - Number(first.viewCount)) / elapsedDays);
    }
  }
  // Fallback: lifetime average.
  const total = Number(v.viewCount);
  const ageDays = (Date.now() - v.publishedAt.getTime()) / 86_400_000;
  if (ageDays <= 0) return total; // publicado agora — usa total
  return total / ageDays;
}

/** Mediana de uma lista (ordena cópia, devolve elemento central ou média dos 2 centrais). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
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
  viewCount: number | bigint;
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
    viewCount: Number(v.viewCount),
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

// =============================================================================
// Snapshot retention — keeps DB lean over time
// =============================================================================

/**
 * Hard-deletes snapshots beyond the retention window. Runs at the end of
 * every "Atualizar agora" and can be triggered manually via the data section.
 *
 * Returns the row counts removed (or what *would* be removed in dry-run).
 */
export async function cleanupOldSnapshots(options: { dryRun?: boolean } = {}): Promise<{
  videoSnapshots: number;
  channelSnapshots: number;
  videoCutoff: string;
  channelCutoff: string;
}> {
  const prisma = getPrisma();
  const videoCutoff = new Date(Date.now() - VIDEO_SNAPSHOT_RETENTION_DAYS * 86_400_000);
  const channelCutoff = new Date(Date.now() - CHANNEL_SNAPSHOT_RETENTION_DAYS * 86_400_000);

  if (options.dryRun) {
    const [videoCount, channelCount] = await Promise.all([
      prisma.videoSnapshot.count({ where: { takenAt: { lt: videoCutoff } } }),
      prisma.channelSnapshot.count({ where: { takenAt: { lt: channelCutoff } } }),
    ]);
    return {
      videoSnapshots: videoCount,
      channelSnapshots: channelCount,
      videoCutoff: videoCutoff.toISOString(),
      channelCutoff: channelCutoff.toISOString(),
    };
  }

  const [videoResult, channelResult] = await Promise.all([
    prisma.videoSnapshot.deleteMany({ where: { takenAt: { lt: videoCutoff } } }),
    prisma.channelSnapshot.deleteMany({ where: { takenAt: { lt: channelCutoff } } }),
  ]);

  return {
    videoSnapshots: videoResult.count,
    channelSnapshots: channelResult.count,
    videoCutoff: videoCutoff.toISOString(),
    channelCutoff: channelCutoff.toISOString(),
  };
}
