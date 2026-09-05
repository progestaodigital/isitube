import { getPrisma } from '../../db';
import { getOutlierThreshold } from '../channels';
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

  const [threshold, averages] = await Promise.all([
    getOutlierThreshold(),
    channelLifetimeAverages(videos.map((v) => v.channelId)),
  ]);

  return videos.map((v) => projectLibraryItem(v, averages.get(v.channelId) ?? 0, threshold));
}

/**
 * Média de views por vídeo de cada canal, **sem janela de tempo**.
 *
 * Por que existe: o `flaggedAsOutlier` gravado no banco é recalculado a cada
 * atualização olhando só os últimos 30 dias (ver `channels/index.ts`), então
 * todo vídeo perde o selo de "em alta" ao envelhecer. Na Biblioteca isso é
 * errado — um vídeo de 3 meses com 500 mil views num canal que faz 100 mil
 * continua sendo um vídeo em alta. Aqui a comparação é vitalícia.
 *
 * Fonte preferida: as estatísticas do próprio canal (`totalViewCount /
 * videoCount`), que cobrem o catálogo inteiro mesmo que a gente só monitore
 * parte dele. Se o canal não tiver essas stats, cai pra média dos vídeos que
 * temos guardados.
 */
async function channelLifetimeAverages(
  channelIds: string[]
): Promise<Map<string, number>> {
  const ids = Array.from(new Set(channelIds));
  const out = new Map<string, number>();
  if (ids.length === 0) return out;

  const prisma = getPrisma();
  const channels = await prisma.channel.findMany({
    where: { id: { in: ids } },
    select: { id: true, totalViewCount: true, videoCount: true },
  });

  const needFallback: string[] = [];
  for (const id of ids) {
    const c = channels.find((x) => x.id === id);
    const total = c?.totalViewCount != null ? Number(c.totalViewCount) : 0;
    const count = c?.videoCount ?? 0;
    if (total > 0 && count > 0) out.set(id, total / count);
    else needFallback.push(id);
  }

  if (needFallback.length > 0) {
    const grouped = await prisma.video.groupBy({
      by: ['channelId'],
      where: { channelId: { in: needFallback }, deletedAt: null },
      _avg: { viewCount: true },
    });
    for (const g of grouped) {
      const avg = g._avg.viewCount;
      if (avg != null && Number(avg) > 0) out.set(g.channelId, Number(avg));
    }
  }

  return out;
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

function projectLibraryItem(
  v: DbVideoForLibrary,
  channelAvgViews: number,
  thresholdPercent: number
): LibraryItem {
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

  // Dois marcadores independentes, de propósito:
  //   - `flaggedAsOutlier` (do banco) = em alta NO PERÍODO: views/dia nos
  //     últimos 30d vs. os outros vídeos ativos. Some quando o vídeo envelhece,
  //     e isso é correto — mede tração de agora.
  //   - `lifetimeOutlier` (calculado aqui) = em alta SEM JANELA: total de views
  //     vs. média histórica do canal. Não expira.
  // Um vídeo novo bombando é só do período; um clássico de 3 meses é só
  // vitalício; um hit recente é os dois.
  const views = Number(v.viewCount);
  const lifetimePercent = channelAvgViews > 0 ? (views / channelAvgViews) * 100 : null;
  const isOutlier = lifetimePercent !== null && lifetimePercent >= thresholdPercent;

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
    // Segundo marcador, vitalício — convive com o do período acima.
    channelLifetimeAvgViews: channelAvgViews > 0 ? Math.round(channelAvgViews) : null,
    lifetimeOutlierPercent: lifetimePercent,
    lifetimeOutlier: isOutlier,
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
