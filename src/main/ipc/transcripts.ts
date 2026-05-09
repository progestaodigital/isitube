import { ipcMain } from 'electron';
import {
  exportTranscript,
  extractTranscript,
  getTranscript,
} from '../services/transcripts';

const VALID_FORMATS = new Set(['txt', 'md']);

export function registerTranscriptsHandlers(): void {
  ipcMain.handle('transcripts:get', async (_event, videoId: unknown) => {
    if (typeof videoId !== 'string') throw new Error('transcripts:get expects a string id');
    return getTranscript(videoId);
  });

  ipcMain.handle('transcripts:extract', async (_event, videoId: unknown) => {
    if (typeof videoId !== 'string') throw new Error('transcripts:extract expects a string id');
    return extractTranscript(videoId);
  });

  ipcMain.handle(
    'transcripts:export',
    async (_event, videoId: unknown, format: unknown) => {
      if (typeof videoId !== 'string') throw new Error('transcripts:export expects a string id');
      if (typeof format !== 'string' || !VALID_FORMATS.has(format)) {
        throw new Error('transcripts:export expects format "txt" or "md"');
      }
      return exportTranscript(videoId, format as 'txt' | 'md');
    }
  );
}
