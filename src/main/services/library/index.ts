import { getPrisma } from '../../db';
import type {
  LibraryActionResult,
  LibraryFilters,
  LibraryItem,
  VideoType,
} from '@shared/types';

const SHORTS_MAX_DURATION_SEC = 180;

export async function addToLibrary(
  videoId: string,
  notes: string | null = null
): Promise<LibraryActionResult> {
  const prisma = getPrisma();
  const video = await prisma.video.findFirst({
    where: { id: videoId, deletedAt: null },
    select: { id: true, inLibrary: true },
  });
  if (!video) {
    return { success: false, message: 'Vídeo não encontrado.', inLibrary: false };
  }
  if (video.inLibrary) {
    return { success: true, message: 'Vídeo já estava na biblioteca.', inLibrary: true };
  }
  await prisma.video.update({
    where: { id: videoId },
    data: {
      inLibrary: true,
      libraryAddedAt: new Date(),
      ...(notes !== null ? { libraryNotes: notes } : {}),
    },
  });
  return { success: true, message: 'Salvo na biblioteca.', inLibrary: true };
}

export async function removeFromLibrary(videoId: string): Promise<LibraryActionResult> {
  const prisma = getPrisma();
  const video = await prisma.video.findFirst({
    where: { id: videoId },
    select: { id: true, inLibrary: true },
  });
  if (!video) {
    return { success: false, message: 'Vídeo não encontrado.', inLibrary: false };
  }
  if (!video.inLibrary) {
    return { success: true, message: 'Vídeo não estava na biblioteca.', inLibrary: false };
  }
  await prisma.video.update({
    where: { id: videoId },
    data: { inLibrary: false, libraryAddedAt: null },
  });
  return { success: true, message: 'Removido da biblioteca.', inLibrary: false };
}

export async function updateLibraryNotes(
  videoId: string,
  notes: string
): Promise<LibraryActionResult> {
  const prisma = getPrisma();
  const video = await prisma.video.findFirst({
    where: { id: videoId, deletedAt: null },
    select: { id: true, inLibrary: true },
  });
  if (!video) {
    return { success: false, message: 'Vídeo não encontrado.', inLibrary: false };
  }
  await prisma.video.update({
    where: { id: videoId },
    data: { libraryNotes: notes },
  });
  return { success: true, message: 'Anotação atualizada.', inLibrary: video.inLibrary };
}

export async function countLibrary(): Promise<number> {
  return getPrisma().video.count({
    where: { deletedAt: null, inLibrary: true },
  });
}

function durationWhere(videoType: VideoType | undefined) {
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

export async function listLibrary(
  filters: LibraryFilters = {}
): Promise<LibraryItem[]> {
  const prisma = getPrisma();

  // Sort: libraryAddedAt é a ordem natural (mais novo no topo). 'mostViews'
  // e 'title' ordenam por colunas estáveis, sem precisar dropar pra memória.
  const orderBy: Record<string, 'asc' | 'desc'> =
    filters.sort === 'oldest'
      ? { libraryAddedAt: 'asc' }
      : filters.sort === 'mostViews'
        ? { viewCount: 'desc' }
        : filters.sort === 'title'
          ? { title: 'asc' }
          : { libraryAddedAt: 'desc' };

  const videos = await prisma.video.findMany({
    where: {
      deletedAt: null,
      inLibrary: true,
      ...(filters.channelId ? { channelId: filters.channelId } : {}),
      ...(filters.query
        ? { title: { contains: filters.query } }
        : {}),
      ...durationWhere(filters.videoType),
    },
    orderBy,
    take: 500,
    include: { channel: { select: { title: true } } },
  });

  return videos.map(projectLibraryItem);
}

type DbVideoForLibrary = {
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
  inLibrary: boolean;
  libraryAddedAt: Date | null;
  libraryNotes: string | null;
};

function projectLibraryItem(v: DbVideoForLibrary): LibraryItem {
  let parsedTags: string[] | null = null;
  if (v.tags) {
    try {
      const parsed = JSON.parse(v.tags);
      if (Array.isArray(parsed)) parsedTags = parsed.filter((t) => typeof t === 'string');
    } catch {
      parsedTags = null;
    }
  }
  // libraryAddedAt nunca deveria ser null aqui (filtramos por inLibrary=true),
  // mas defensivamente usamos createdAt como fallback se for o caso.
  const addedAtIso = (v.libraryAddedAt ?? v.publishedAt).toISOString();

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
    inLibrary: v.inLibrary,
    libraryAddedAt: addedAtIso,
    libraryNotes: v.libraryNotes,
  };
}
