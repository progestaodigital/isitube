import { getPrisma } from '../../db';
import { YouTubeMockMetadataProvider } from './providers/youtube-mock';
import { YouTubeRealMetadataProvider } from './providers/youtube-real';
import type { VideoMetadataProvider } from './providers/types';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import type {
  ExtractedVideosFilters,
  VideoDetail,
  VideoMetadataExtractionResult,
} from '@shared/types';

async function getProvider(): Promise<VideoMetadataProvider> {
  const status = await getCredentialStatus('youtube');
  if (status?.status === 'valid' && status.hasValue) {
    const key = await getCredentialPlainText('youtube');
    // Plano Pro / BYOK path. Plano Iniciante (proxy) wires in 9.A.2.
    if (key) return new YouTubeRealMetadataProvider({ mode: 'direct', apiKey: key });
  }
  return new YouTubeMockMetadataProvider();
}

type DbVideo = {
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
  description: string | null;
  tags: string | null;
  thumbnailHdUrl: string | null;
  language: string | null;
  category: string | null;
  liveBroadcastStatus: string | null;
  metadataExtractedAt: Date | null;
  transcriptStatus: string | null;
  transcriptLanguage: string | null;
  transcriptExtractedAt: Date | null;
};

function projectVideoDetail(v: DbVideo): VideoDetail {
  let parsedTags: string[] | null = null;
  if (v.tags) {
    try {
      const parsed = JSON.parse(v.tags);
      if (Array.isArray(parsed)) parsedTags = parsed.filter((t) => typeof t === 'string');
    } catch {
      parsedTags = null;
    }
  }
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
    description: v.description,
    tags: parsedTags,
    thumbnailHdUrl: v.thumbnailHdUrl,
    language: v.language,
    category: v.category,
    liveBroadcastStatus: v.liveBroadcastStatus,
    metadataExtractedAt: v.metadataExtractedAt?.toISOString() ?? null,
    transcriptStatus:
      v.transcriptStatus === 'available' || v.transcriptStatus === 'unavailable'
        ? v.transcriptStatus
        : null,
    transcriptLanguage: v.transcriptLanguage,
    transcriptExtractedAt: v.transcriptExtractedAt?.toISOString() ?? null,
  };
}

export async function getVideoDetail(videoId: string): Promise<VideoDetail | null> {
  const v = await getPrisma().video.findFirst({
    where: { id: videoId, deletedAt: null },
    include: { channel: { select: { title: true } } },
  });
  if (!v) return null;
  return projectVideoDetail(v);
}

export async function extractVideoMetadata(
  videoId: string
): Promise<VideoMetadataExtractionResult> {
  const prisma = getPrisma();

  const video = await prisma.video.findFirst({
    where: { id: videoId, deletedAt: null },
    include: { channel: { select: { title: true } } },
  });
  if (!video) {
    return { success: false, message: 'Vídeo não encontrado.' };
  }

  const status = await getCredentialStatus('youtube');
  if (!(status?.status === 'valid' && status.hasValue)) {
    return {
      success: false,
      message:
        'YouTube Data API key não configurada ou inválida. Configure em Configurações → YouTube Data API.',
    };
  }

  const provider = await getProvider();
  let fetched;
  try {
    fetched = await provider.fetchMetadata(video.youtubeId, video.title, video.durationSec);
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha ao extrair metadata.',
    };
  }

  const updated = await prisma.video.update({
    where: { id: video.id },
    data: {
      description: fetched.description,
      tags: JSON.stringify(fetched.tags),
      thumbnailHdUrl: fetched.thumbnailHdUrl,
      language: fetched.language,
      category: fetched.category,
      liveBroadcastStatus: fetched.liveBroadcastStatus,
      metadataExtractedAt: new Date(),
    },
    include: { channel: { select: { title: true } } },
  });

  return {
    success: true,
    message: 'Metadata extraída e salva localmente.',
    video: projectVideoDetail(updated),
  };
}

export async function removeVideo(videoId: string): Promise<void> {
  await getPrisma().video.update({
    where: { id: videoId },
    data: { deletedAt: new Date() },
  });
}

export async function removeVideos(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) return 0;
  const result = await getPrisma().video.updateMany({
    where: { id: { in: videoIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return result.count;
}

/** Lista vídeos soft-deleted (ainda no DB, deletedAt != null). */
export async function listDeletedVideos(): Promise<VideoDetail[]> {
  const videos = await getPrisma().video.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    take: 500,
    include: { channel: { select: { title: true } } },
  });
  return videos.map(projectVideoDetail);
}

/** Restaura vídeos soft-deleted (limpa deletedAt). */
export async function restoreVideos(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) return 0;
  const result = await getPrisma().video.updateMany({
    where: { id: { in: videoIds }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  return result.count;
}

/**
 * Apaga DEFINITIVAMENTE os vídeos selecionados (DELETE no DB, sem volta).
 * Cascateia em snapshots e relacionamentos via FK.
 */
export async function purgeVideos(videoIds: string[]): Promise<number> {
  if (videoIds.length === 0) return 0;
  const result = await getPrisma().video.deleteMany({
    where: { id: { in: videoIds }, deletedAt: { not: null } },
  });
  return result.count;
}

const SHORTS_MAX_DURATION_SEC = 180;

export async function listExtractedVideos(
  filters: ExtractedVideosFilters = {}
): Promise<VideoDetail[]> {
  const videos = await getPrisma().video.findMany({
    where: {
      deletedAt: null,
      metadataExtractedAt: { not: null },
      ...(filters.channelId ? { channelId: filters.channelId } : {}),
      ...(filters.flaggedOnly ? { flaggedAsOutlier: true } : {}),
      ...(filters.videoType === 'shorts'
        ? { durationSec: { lte: SHORTS_MAX_DURATION_SEC, gt: 0 } }
        : filters.videoType === 'long'
          ? { durationSec: { gt: SHORTS_MAX_DURATION_SEC } }
          : filters.videoType === 'unknown'
            ? { OR: [{ durationSec: null }, { durationSec: 0 }] }
            : {}),
    },
    orderBy: { metadataExtractedAt: 'desc' },
    take: 200,
    include: { channel: { select: { title: true } } },
  });
  return videos.map(projectVideoDetail);
}
