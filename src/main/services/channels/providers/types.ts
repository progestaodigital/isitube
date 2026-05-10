export type FetchedChannel = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  totalViewCount: number | null;
};

export type FetchedVideo = {
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  durationSec: number | null;
  publishedAt: string; // ISO
};

export type VideoStatsUpdate = {
  youtubeId: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  /**
   * Duration in seconds. Refreshed alongside stats so that videos ingested
   * during a live/premiere window (when YouTube returns P0D → null duration)
   * heal themselves on the next update.
   */
  durationSec: number | null;
};

export type ListAllVideosOptions = {
  /**
   * If set, stop paging once we hit a video published before this date. Used
   * for incremental updates (only fetch what's new since last sync).
   */
  since?: Date;
  /** Optional progress callback — called after each page (50 videos). */
  onProgress?: (fetched: number, totalEstimate: number | null) => void;
};

export interface ChannelProvider {
  readonly name: string;

  /**
   * Resolve a channel by URL or raw ID. Should accept anything reasonable:
   *   - UC...... (24-char channel ID)
   *   - youtube.com/channel/UC...
   *   - youtube.com/@handle
   *   - youtube.com/c/customname
   * Throws on invalid input or upstream failure.
   */
  lookupChannel(urlOrId: string): Promise<FetchedChannel>;

  /**
   * Recent uploads for a channel — limit by count or by lookback days.
   */
  listRecentVideos(channelYoutubeId: string, lookbackDays: number): Promise<FetchedVideo[]>;

  /**
   * List ALL uploads from a channel via the channel's "uploads" playlist
   * (cheap path: 1 quota unit per 50 videos for paging + 1 unit per 50 for stats).
   * Used at channel-add time and for incremental "what's new" lookups.
   */
  listAllVideos(channelYoutubeId: string, options?: ListAllVideosOptions): Promise<FetchedVideo[]>;

  /**
   * Cheap stats refresh for known video ids (1 unit per 50 ids). Used by the
   * recurring "Atualizar agora" to re-snapshot stored videos without re-fetching
   * metadata (title, thumbnail, etc).
   */
  refreshVideoStats(videoYoutubeIds: string[]): Promise<VideoStatsUpdate[]>;
}
