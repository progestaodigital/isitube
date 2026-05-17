import type { FetchedVideoMetadata, VideoMetadataProvider } from './types';
import type { ExternalApiConfig } from '../../external/types';
import { fetchWithQuotaTracking } from '../../external/quota';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

const DIRECT_BASE = 'https://www.googleapis.com/youtube/v3';

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
 *
 * Accepts either direct (BYOK / Plano Pro) or proxy (Plano Iniciante via
 * isipanel) config; see ../../external/types.ts.
 */
export class YouTubeRealMetadataProvider implements VideoMetadataProvider {
  readonly name = 'youtube-data-api-v3';

  private readonly baseUrl: string;
  private readonly authMode: 'key-query' | 'bearer';
  private readonly secret: string;

  constructor(config: ExternalApiConfig) {
    if (config.mode === 'proxy') {
      this.baseUrl = config.baseUrl;
      this.authMode = 'bearer';
      this.secret = config.licenseKey;
    } else {
      this.baseUrl = DIRECT_BASE;
      this.authMode = 'key-query';
      this.secret = config.apiKey;
    }
  }

  async fetchMetadata(
    videoYoutubeId: string,
    _videoTitle: string,
    _videoDurationSec?: number | null
  ): Promise<FetchedVideoMetadata> {
    const path =
      `/videos?part=snippet,topicDetails,liveStreamingDetails` +
      `&id=${encodeURIComponent(videoYoutubeId)}`;
    const url = this.buildUrl(path);
    const headers = this.buildHeaders();

    let data: any;
    try {
      const res = await fetchWithQuotaTracking('youtube', url, { headers });
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
      data = await res.json();
      recordSuccess('youtube-data-api');
    } catch (err) {
      recordFailure('youtube-data-api', err);
      throw err;
    }

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

  private buildUrl(path: string): string {
    if (this.authMode === 'key-query') {
      const sep = path.includes('?') ? '&' : '?';
      return `${this.baseUrl}${path}${sep}key=${encodeURIComponent(this.secret)}`;
    }
    return `${this.baseUrl}${path}`;
  }

  private buildHeaders(): Record<string, string> {
    if (this.authMode === 'bearer') {
      return { Authorization: `Bearer ${this.secret}` };
    }
    return {};
  }
}
