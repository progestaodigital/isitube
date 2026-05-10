import type {
  ChannelProvider,
  FetchedChannel,
  FetchedVideo,
  ListAllVideosOptions,
  VideoStatsUpdate,
} from './types';
import {
  delay,
  extractChannelId,
  mockChannelTitleFromInput,
  mockVideoTitle,
  pick,
  rangeInt,
  rng,
  strHash,
  svgInitialsDataUrl,
  svgVideoThumbnailDataUrl,
} from './utils';

/**
 * Phase 4 mock — Phase 8 will replace this with real YouTube Data API calls
 * (channels.list, search.list with channelId filter ordered by date).
 *
 * Guarantees: same input id always yields same channel + same video set, so
 * outlier flags don't shuffle between updates in dev.
 */
export class YouTubeMockProvider implements ChannelProvider {
  readonly name = 'youtube-mock';

  async lookupChannel(urlOrId: string): Promise<FetchedChannel> {
    await delay(400, 1000);

    const youtubeId = extractChannelId(urlOrId);
    const seed = strHash(youtubeId);
    const rand = rng(seed);
    const title = mockChannelTitleFromInput(urlOrId, rand);

    const subscriberCount = rangeInt(rand, 5_000, 5_000_000);
    const videoCount = rangeInt(rand, 30, 500);
    // Plausible total view count: average ~10k-500k views per video.
    const totalViewCount = videoCount * rangeInt(rand, 10_000, 500_000);

    return {
      youtubeId,
      title,
      thumbnailUrl: svgInitialsDataUrl(youtubeId, title),
      subscriberCount,
      videoCount,
      totalViewCount,
    };
  }

  async listRecentVideos(channelYoutubeId: string, lookbackDays: number): Promise<FetchedVideo[]> {
    await delay(600, 1500);
    const since = new Date(Date.now() - lookbackDays * 86_400_000);
    const all = this.generateAllVideos(channelYoutubeId);
    return all.filter((v) => new Date(v.publishedAt).getTime() >= since.getTime());
  }

  async listAllVideos(
    channelYoutubeId: string,
    options: ListAllVideosOptions = {}
  ): Promise<FetchedVideo[]> {
    await delay(800, 2000);
    const all = this.generateAllVideos(channelYoutubeId);
    const filtered = options.since
      ? all.filter(
          (v) => new Date(v.publishedAt).getTime() >= options.since!.getTime()
        )
      : all;
    options.onProgress?.(filtered.length, filtered.length);
    return filtered;
  }

  async refreshVideoStats(videoYoutubeIds: string[]): Promise<VideoStatsUpdate[]> {
    await delay(200, 500);
    return videoYoutubeIds.map((youtubeId) => {
      const seed = strHash(youtubeId) ^ Date.now();
      const rand = rng(seed);
      const baseViews = strHash(youtubeId) % 100_000 + 1_000;
      const drift = Math.floor(rand() * 200);
      const viewCount = baseViews + drift;
      const durSeed = strHash(youtubeId);
      const durationSec = 60 + (durSeed % 1740);
      return {
        youtubeId,
        viewCount,
        likeCount: Math.round(viewCount * 0.04),
        commentCount: Math.round(viewCount * 0.003),
        durationSec,
        ...mockMetadata(youtubeId),
      };
    });
  }

  /**
   * Deterministic full-catalog generator. Larger than listRecentVideos so the
   * mock evergreen behavior is non-trivial.
   */
  private generateAllVideos(channelYoutubeId: string): FetchedVideo[] {
    const seed = strHash(channelYoutubeId) ^ 0xbeef;
    const rand = rng(seed);
    const numVideos = rangeInt(rand, 30, 120);
    const baseAvgViews = rangeInt(rand, 2_000, 60_000);

    // Spread across ~3 years so older videos exist for evergreen testing.
    const totalDays = 3 * 365;

    return Array.from({ length: numVideos }, (_, i) => {
      const daysAgo = Math.floor((i / numVideos) * totalDays + rand() * 5);
      const publishedAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

      const isOutlier = i === 1 || (i === 4 && rand() > 0.45);
      const viewMult = isOutlier ? rangeInt(rand, 3, 9) : 1;
      const viewCount = Math.max(
        100,
        Math.round(baseAvgViews * viewMult * (0.5 + rand()))
      );

      const title = mockVideoTitle(rand);
      const youtubeId = mockVideoYoutubeId(channelYoutubeId, i);
      const durationSec = rangeInt(rand, 60, 1800);

      return {
        youtubeId,
        title,
        thumbnailUrl: svgVideoThumbnailDataUrl(youtubeId, title, durationSec),
        viewCount,
        likeCount: Math.round(viewCount * (0.02 + rand() * 0.05)),
        commentCount: Math.round(viewCount * (0.001 + rand() * 0.005)),
        durationSec,
        publishedAt,
        ...mockMetadata(youtubeId),
      };
    });
  }
}

/**
 * Metadata sintética determinística por youtubeId — mesmas tags/description/etc
 * sempre, pra que mock fique reproduzível. Categoria escolhida em pool fixo
 * pra exercitar o filtro de categoria na UI.
 */
const MOCK_TAG_POOL = [
  'tutorial', 'guia', 'dicas', 'iniciantes', 'avançado', 'tecnologia',
  'inteligência artificial', 'produtividade', 'finanças pessoais',
  'empreendedorismo', 'marketing digital', 'youtube', 'criação de conteúdo',
];
const MOCK_CATEGORIES = [
  'Educação', 'Como fazer & Estilo', 'Ciência & Tecnologia', 'Pessoas & Blogs',
];
const MOCK_LANGUAGES = ['pt-BR', 'en-US', 'pt'];

function mockMetadata(youtubeId: string): {
  description: string;
  tags: string[];
  thumbnailHdUrl: string | null;
  language: string;
  category: string;
  liveBroadcastStatus: string;
} {
  const seed = strHash(youtubeId);
  const rand = rng(seed);
  const numTags = 3 + Math.floor(rand() * 5); // 3-7 tags
  const tags = Array.from({ length: numTags }, () =>
    MOCK_TAG_POOL[Math.floor(rand() * MOCK_TAG_POOL.length)]!
  );
  return {
    description:
      `Descrição mock pro vídeo ${youtubeId.slice(0, 6)}.\n\nLinks úteis:\n` +
      `https://isitube.app\nhttps://example.com\n\nTimestamps:\n00:00 Intro\n01:30 Conteúdo\n08:00 Conclusão`,
    tags: Array.from(new Set(tags)),
    thumbnailHdUrl: null,
    language: MOCK_LANGUAGES[Math.floor(rand() * MOCK_LANGUAGES.length)]!,
    category: MOCK_CATEGORIES[Math.floor(rand() * MOCK_CATEGORIES.length)]!,
    liveBroadcastStatus: 'none',
  };
}

function mockVideoYoutubeId(channelId: string, index: number): string {
  // 11-char-ish synthetic video id — deterministic from (channel, index).
  const seed = strHash(`${channelId}::${index}`);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let n = seed;
  let out = '';
  for (let i = 0; i < 11; i++) {
    n = (n * 9301 + 49297 + i * 7) >>> 0;
    out += alphabet[n % alphabet.length];
  }
  return out;
}

void pick; // re-export marker (used indirectly in templates)
void svgInitialsDataUrl; // re-exported for use by channel avatars elsewhere
