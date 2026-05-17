import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@shared/types';
import type { FetchedTranscript, TranscriptProvider } from './types';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

/**
 * Real transcript provider — uses the `youtube-transcript` npm package which
 * fetches the public caption tracks embedded on the video's watch page (no
 * API key required, no headless browser).
 *
 * Returns `unavailable` when the video has no native captions.
 */
export class YouTubeRealTranscriptProvider implements TranscriptProvider {
  readonly name = 'youtube-transcript';

  async fetch({
    youtubeId,
  }: {
    youtubeId: string;
    durationSec: number | null;
  }): Promise<FetchedTranscript> {
    let raw: Array<{ text: string; offset: number; duration: number; lang?: string }>;
    try {
      // Try Portuguese first; if missing, the lib falls back to the default track.
      raw = (await YoutubeTranscript.fetchTranscript(youtubeId, {
        lang: 'pt',
      })) as Array<{ text: string; offset: number; duration: number; lang?: string }>;
      recordSuccess('youtube-transcript');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "Sem legendas" não é erro de integração — é estado natural do vídeo.
      // Conta como sucesso (a chamada respondeu corretamente "indisponível").
      if (/transcript|captions|disabled/i.test(msg)) {
        recordSuccess('youtube-transcript');
        return { status: 'unavailable', language: null, segments: [] };
      }
      recordFailure('youtube-transcript', err);
      throw err;
    }

    if (!raw || raw.length === 0) {
      return { status: 'unavailable', language: null, segments: [] };
    }

    const segments: TranscriptSegment[] = raw.map((p) => ({
      // The lib returns offset in milliseconds. Our schema stores seconds.
      start: Math.round(p.offset / 1000),
      text: cleanText(p.text),
    }));

    const language = raw[0]?.lang ?? null;
    return { status: 'available', language, segments };
  }
}

function cleanText(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
