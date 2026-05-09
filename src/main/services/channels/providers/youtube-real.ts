import type {
  ChannelProvider,
  FetchedChannel,
  FetchedVideo,
  ListAllVideosOptions,
  VideoStatsUpdate,
} from './types';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const VIDEOS_BATCH = 50; // YouTube videos.list max ids per request
const PLAYLIST_PAGE = 50; // YouTube playlistItems.list max per page

/**
 * Real YouTube Data API v3 provider. Selected by the factory only when the
 * user's `youtube` credential is in `valid` status.
 *
 * Quota costs (10,000 units/day default tier):
 *   - channels.list:       1
 *   - search.list:         100  (heavy — only used as last-resort lookup)
 *   - playlistItems.list:  1   (preferred for listing channel uploads)
 *   - videos.list:         1   (per call, up to 50 ids)
 *
 * Cheap path for "all videos of channel N":
 *   N/50 playlistItems calls + N/50 videos.list calls = N/25 units total.
 *   1.000 vídeos = 40 unidades. 5.000 vídeos = 200 unidades.
 */
export class YouTubeRealProvider implements ChannelProvider {
  readonly name = 'youtube-data-api-v3';

  // Cache the uploads playlist id per channel so we don't re-resolve it on
  // every refresh. Channels rarely change their uploads playlist id.
  private uploadsPlaylistCache = new Map<string, string>();

  constructor(private readonly apiKey: string) {}

  async lookupChannel(urlOrId: string): Promise<FetchedChannel> {
    const id = await this.resolveChannelId(urlOrId);
    const data = await this.fetchJSON(
      `/channels?part=snippet,statistics,contentDetails&id=${id}`
    );
    if (!data.items || data.items.length === 0) {
      throw new Error('Canal não encontrado.');
    }
    const ch = data.items[0];
    const thumbs = ch.snippet?.thumbnails ?? {};
    const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) this.uploadsPlaylistCache.set(ch.id, uploads);
    return {
      youtubeId: ch.id,
      title: ch.snippet?.title ?? id,
      thumbnailUrl:
        thumbs.high?.url ?? thumbs.medium?.url ?? thumbs.default?.url ?? null,
      subscriberCount: numOrNull(ch.statistics?.subscriberCount),
      videoCount: numOrNull(ch.statistics?.videoCount),
      totalViewCount: numOrNull(ch.statistics?.viewCount),
    };
  }

  async listRecentVideos(
    channelYoutubeId: string,
    lookbackDays: number
  ): Promise<FetchedVideo[]> {
    // Implemented in terms of listAllVideos with a `since` cutoff — same
    // cheap path (uploads playlist + videos.list) instead of search.list.
    const since = new Date(Date.now() - lookbackDays * 86_400_000);
    return this.listAllVideos(channelYoutubeId, { since });
  }

  async listAllVideos(
    channelYoutubeId: string,
    options: ListAllVideosOptions = {}
  ): Promise<FetchedVideo[]> {
    const uploadsPlaylistId = await this.resolveUploadsPlaylistId(channelYoutubeId);

    const collectedIds: string[] = [];
    const publishedAtById = new Map<string, string>();
    let pageToken: string | undefined;
    let stopped = false;

    while (!stopped) {
      const url =
        `/playlistItems?part=contentDetails,snippet&playlistId=${uploadsPlaylistId}` +
        `&maxResults=${PLAYLIST_PAGE}` +
        (pageToken ? `&pageToken=${pageToken}` : '');
      const page = await this.fetchJSON(url);

      for (const item of page.items ?? []) {
        const id = item.contentDetails?.videoId as string | undefined;
        const publishedAt =
          (item.contentDetails?.videoPublishedAt as string | undefined) ??
          (item.snippet?.publishedAt as string | undefined);
        if (!id) continue;

        if (options.since && publishedAt) {
          if (new Date(publishedAt).getTime() < options.since.getTime()) {
            // playlistItems is ordered newest-first — once we cross the cutoff
            // every subsequent video is also older. Stop entirely.
            stopped = true;
            break;
          }
        }
        collectedIds.push(id);
        if (publishedAt) publishedAtById.set(id, publishedAt);
      }

      options.onProgress?.(collectedIds.length, page.pageInfo?.totalResults ?? null);

      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }

    if (collectedIds.length === 0) return [];

    return this.fetchVideoDetails(collectedIds, publishedAtById);
  }

  async refreshVideoStats(videoYoutubeIds: string[]): Promise<VideoStatsUpdate[]> {
    if (videoYoutubeIds.length === 0) return [];
    const out: VideoStatsUpdate[] = [];
    for (const batch of chunk(videoYoutubeIds, VIDEOS_BATCH)) {
      const data = await this.fetchJSON(
        `/videos?part=statistics&id=${batch.join(',')}`
      );
      for (const v of (data.items ?? []) as YoutubeVideoApiItem[]) {
        out.push({
          youtubeId: v.id,
          viewCount: numOrZero(v.statistics?.viewCount),
          likeCount: numOrNull(v.statistics?.likeCount),
          commentCount: numOrNull(v.statistics?.commentCount),
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async resolveUploadsPlaylistId(channelYoutubeId: string): Promise<string> {
    const cached = this.uploadsPlaylistCache.get(channelYoutubeId);
    if (cached) return cached;
    const data = await this.fetchJSON(
      `/channels?part=contentDetails&id=${channelYoutubeId}`
    );
    const id = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!id) throw new Error('Não foi possível localizar a playlist de uploads do canal.');
    this.uploadsPlaylistCache.set(channelYoutubeId, id);
    return id;
  }

  /**
   * Hydrate full video details (snippet + statistics + duration) for a list of
   * video ids. Batches into groups of 50 (videos.list cap).
   */
  private async fetchVideoDetails(
    ids: string[],
    publishedAtFallback: Map<string, string>
  ): Promise<FetchedVideo[]> {
    const out: FetchedVideo[] = [];
    for (const batch of chunk(ids, VIDEOS_BATCH)) {
      const data = await this.fetchJSON(
        `/videos?part=snippet,statistics,contentDetails&id=${batch.join(',')}`
      );
      for (const v of (data.items ?? []) as YoutubeVideoApiItem[]) {
        const thumbs = v.snippet?.thumbnails ?? {};
        out.push({
          youtubeId: v.id,
          title: v.snippet?.title ?? '',
          thumbnailUrl:
            thumbs.medium?.url ?? thumbs.high?.url ?? thumbs.default?.url ?? null,
          viewCount: numOrZero(v.statistics?.viewCount),
          likeCount: numOrNull(v.statistics?.likeCount),
          commentCount: numOrNull(v.statistics?.commentCount),
          durationSec: parseISO8601Duration(v.contentDetails?.duration),
          publishedAt:
            v.snippet?.publishedAt ??
            publishedAtFallback.get(v.id) ??
            new Date().toISOString(),
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Channel ID resolution — accept anything reasonable and return the UC... id.
  // ---------------------------------------------------------------------------

  private async resolveChannelId(urlOrId: string): Promise<string> {
    const trimmed = urlOrId.trim();

    // Already a UC... ID
    const ucMatch = trimmed.match(/UC[A-Za-z0-9_-]{22}/);
    if (ucMatch) return ucMatch[0];

    // @handle (or "youtube.com/@handle")
    const handleMatch = trimmed.match(/@([A-Za-z0-9._-]+)/);
    if (handleMatch) {
      const handle = handleMatch[1]!;
      const data = await this.fetchJSON(
        `/channels?part=id&forHandle=${encodeURIComponent('@' + handle)}`
      );
      const id = data.items?.[0]?.id;
      if (id) return id;
      throw new Error(`Canal @${handle} não encontrado.`);
    }

    // /c/customname or /user/legacyusername
    const customMatch = trimmed.match(
      /(?:youtube\.com\/(?:c|user)\/)([A-Za-z0-9._-]+)/
    );
    if (customMatch) {
      const name = customMatch[1]!;
      // Try forUsername (legacy)
      const data = await this.fetchJSON(
        `/channels?part=id&forUsername=${encodeURIComponent(name)}`
      );
      const id = data.items?.[0]?.id;
      if (id) return id;
      // Fallback: search
      return this.searchChannelId(name);
    }

    // Last resort: free-text search
    return this.searchChannelId(trimmed);
  }

  private async searchChannelId(query: string): Promise<string> {
    const data = await this.fetchJSON(
      `/search?part=id&q=${encodeURIComponent(query)}&type=channel&maxResults=1`
    );
    const id = data.items?.[0]?.id?.channelId;
    if (id) return id;
    throw new Error(`Canal "${query}" não encontrado.`);
  }

  private async fetchJSON(path: string): Promise<any> {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API_BASE}${path}${sep}key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      let msg = `YouTube API error ${res.status}`;
      try {
        const body = await res.json();
        if (body?.error?.message) msg = body.error.message;
      } catch {
        /* swallow non-JSON body */
      }
      throw new Error(msg);
    }
    return res.json();
  }
}

type YoutubeVideoApiItem = {
  id: string;
  snippet?: {
    title?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: { url?: string };
      medium?: { url?: string };
      high?: { url?: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
};

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numOrZero(v: unknown): number {
  return numOrNull(v) ?? 0;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseISO8601Duration(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}
