import { getPrisma } from '../db';

/**
 * Busca global do header — case-insensitive substring nos títulos de canais
 * e vídeos, e nos termos de keywords. Limita 5 hits por categoria pra caber
 * num dropdown sem rolagem.
 *
 * SQLite faz `contains` como LIKE com bind do termo. Sem ILIKE — usamos
 * `mode: 'insensitive'` do Prisma, que vira COLLATE NOCASE no SQLite.
 */
export type GlobalSearchHit =
  | {
      kind: 'channel';
      id: string;
      youtubeId: string;
      title: string;
      thumbnailUrl: string | null;
      subtitle: string | null;
    }
  | {
      kind: 'video';
      id: string;
      youtubeId: string;
      title: string;
      thumbnailUrl: string | null;
      subtitle: string | null;
    }
  | {
      kind: 'keyword';
      id: string;
      term: string;
      lastSearchedAt: string | null;
      scoreValue: number | null;
    };

export type GlobalSearchResult = {
  channels: Extract<GlobalSearchHit, { kind: 'channel' }>[];
  videos: Extract<GlobalSearchHit, { kind: 'video' }>[];
  keywords: Extract<GlobalSearchHit, { kind: 'keyword' }>[];
};

const PER_CATEGORY_LIMIT = 6;

export async function globalSearch(rawQuery: string): Promise<GlobalSearchResult> {
  const query = rawQuery.trim();
  const empty: GlobalSearchResult = { channels: [], videos: [], keywords: [] };
  if (!query) return empty;

  const prisma = getPrisma();

  const [channels, videos, keywords] = await Promise.all([
    prisma.channel.findMany({
      where: {
        deletedAt: null,
        monitored: true,
        title: { contains: query },
      },
      orderBy: { createdAt: 'asc' },
      take: PER_CATEGORY_LIMIT,
      select: {
        id: true,
        youtubeId: true,
        title: true,
        thumbnailUrl: true,
        subscriberCount: true,
      },
    }),
    prisma.video.findMany({
      where: {
        deletedAt: null,
        title: { contains: query },
      },
      orderBy: { publishedAt: 'desc' },
      take: PER_CATEGORY_LIMIT,
      select: {
        id: true,
        youtubeId: true,
        title: true,
        thumbnailUrl: true,
        channel: { select: { title: true } },
      },
    }),
    prisma.keyword.findMany({
      where: {
        deletedAt: null,
        term: { contains: query.toLowerCase() },
      },
      orderBy: { lastSearchedAt: 'desc' },
      take: PER_CATEGORY_LIMIT,
      include: {
        searches: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { scoreValue: true },
        },
      },
    }),
  ]);

  return {
    channels: channels.map((c) => ({
      kind: 'channel' as const,
      id: c.id,
      youtubeId: c.youtubeId,
      title: c.title,
      thumbnailUrl: c.thumbnailUrl,
      subtitle:
        c.subscriberCount !== null
          ? `${formatCompact(Number(c.subscriberCount))} inscritos`
          : null,
    })),
    videos: videos.map((v) => ({
      kind: 'video' as const,
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      subtitle: v.channel?.title ?? null,
    })),
    keywords: keywords.map((k) => ({
      kind: 'keyword' as const,
      id: k.id,
      term: k.term,
      lastSearchedAt: k.lastSearchedAt?.toISOString() ?? null,
      scoreValue: k.searches[0]?.scoreValue ?? null,
    })),
  };
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
