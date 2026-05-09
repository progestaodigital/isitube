import type { FetchedVideoMetadata, VideoMetadataProvider } from './types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

const CATEGORY_NAMES_PT_BR: Record<string, string> = {
  '1': 'Filme & Animação',
  '2': 'Carros & Veículos',
  '10': 'Música',
  '15': 'Animais',
  '17': 'Esportes',
  '19': 'Viagem & Eventos',
  '20': 'Jogos',
  '22': 'Pessoas & Blogs',
  '23': 'Comédia',
  '24': 'Entretenimento',
  '25': 'Notícias & Política',
  '26': 'Como fazer & Estilo',
  '27': 'Educação',
  '28': 'Ciência & Tecnologia',
  '29': 'Sem fins lucrativos',
};

/**
 * Real YouTube Data API v3 metadata provider. videos.list with
 * part=snippet,topicDetails,liveStreamingDetails costs 1 quota unit per call.
 */
export class YouTubeRealMetadataProvider implements VideoMetadataProvider {
  readonly name = 'youtube-data-api-v3';

  constructor(private readonly apiKey: string) {}

  async fetchMetadata(
    videoYoutubeId: string,
    _videoTitle: string,
    _videoDurationSec?: number | null
  ): Promise<FetchedVideoMetadata> {
    const url =
      `${API_BASE}/videos?part=snippet,topicDetails,liveStreamingDetails` +
      `&id=${encodeURIComponent(videoYoutubeId)}&key=${encodeURIComponent(this.apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) {
      let msg = `YouTube API error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) msg = body.error.message;
      } catch {
        /* swallow */
      }
      throw new Error(msg);
    }

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) throw new Error('Vídeo não encontrado na API do YouTube.');

    const snippet = item.snippet ?? {};
    const thumbs = snippet.thumbnails ?? {};

    return {
      description: snippet.description ?? '',
      tags: Array.isArray(snippet.tags) ? snippet.tags : [],
      thumbnailHdUrl:
        thumbs.maxres?.url ??
        thumbs.high?.url ??
        thumbs.medium?.url ??
        thumbs.default?.url ??
        null,
      language: snippet.defaultAudioLanguage ?? snippet.defaultLanguage ?? null,
      category:
        snippet.categoryId && CATEGORY_NAMES_PT_BR[snippet.categoryId]
          ? CATEGORY_NAMES_PT_BR[snippet.categoryId]!
          : (snippet.categoryId ?? null),
      liveBroadcastStatus: snippet.liveBroadcastContent ?? 'none',
    };
  }
}
