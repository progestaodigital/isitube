import type { TranscriptSegment, TranscriptStatus } from '@shared/types';

export type FetchedTranscript = {
  status: TranscriptStatus;
  language: string | null;
  segments: TranscriptSegment[];
};

export interface TranscriptProvider {
  readonly name: string;

  /**
   * Phase 6 mock — returns generated segments deterministically by youtube id.
   *
   * Phase 8 real — opens an invisible BrowserWindow at the YouTube watch URL,
   * waits for the player to load, simulates click on "Show transcript", parses
   * the resulting panel via DOM. Fallback: intercepts the internal
   * `/youtubei/v1/get_transcript` request via Chromium DevTools Protocol.
   */
  fetch(args: {
    youtubeId: string;
    durationSec: number | null;
  }): Promise<FetchedTranscript>;
}
