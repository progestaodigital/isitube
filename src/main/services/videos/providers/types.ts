export type FetchedVideoMetadata = {
  description: string;
  tags: string[];
  thumbnailHdUrl: string | null;
  language: string | null;
  category: string | null;
  liveBroadcastStatus: string | null;
};

export interface VideoMetadataProvider {
  readonly name: string;

  /**
   * Resolve the full metadata for a single video by its YouTube id. The video
   * title and duration are passed in to give the mock provider context for
   * plausible descriptions, tags and thumbnails. Real Phase-8 provider will
   * ignore them (the Data API resolves everything from the youtube id).
   */
  fetchMetadata(
    videoYoutubeId: string,
    videoTitle: string,
    videoDurationSec?: number | null
  ): Promise<FetchedVideoMetadata>;
}
