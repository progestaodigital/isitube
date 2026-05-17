import { dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { getPrisma } from '../../db';
import { YouTubeRealTranscriptProvider } from './providers/youtube-real';
import type { TranscriptProvider } from './providers/types';
import type {
  TranscriptExportFormat,
  TranscriptExportResult,
  TranscriptExtractionResult,
  TranscriptSegment,
  TranscriptStatus,
  VideoTranscript,
} from '@shared/types';

// Transcripts não precisam de credencial — o pacote youtube-transcript faz
// scraping das caption tracks públicas. Se a chamada por vídeo falhar, o
// service captura e persiste `unavailable`. Mock antigo deletado na Fase 10.B
// (era dead code; void hack de import existia só pra silenciar o lint).
const provider: TranscriptProvider = new YouTubeRealTranscriptProvider();

function parseSegments(json: string | null): TranscriptSegment[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) => typeof s === 'object' && s && typeof s.start === 'number' && typeof s.text === 'string'
    );
  } catch {
    return [];
  }
}

function projectTranscript(v: {
  id: string;
  youtubeId: string;
  transcriptStatus: string | null;
  transcriptLanguage: string | null;
  transcriptSegments: string | null;
  transcriptExtractedAt: Date | null;
}): VideoTranscript | null {
  if (!v.transcriptStatus) return null;
  const segments = v.transcriptStatus === 'available' ? parseSegments(v.transcriptSegments) : [];
  return {
    videoId: v.id,
    youtubeId: v.youtubeId,
    status: v.transcriptStatus as TranscriptStatus,
    language: v.transcriptLanguage,
    segments,
    fullText: segments.map((s) => s.text).join(' '),
    extractedAt: v.transcriptExtractedAt?.toISOString() ?? null,
  };
}

export async function getTranscript(videoId: string): Promise<VideoTranscript | null> {
  const v = await getPrisma().video.findFirst({
    where: { id: videoId, deletedAt: null },
  });
  if (!v) return null;
  return projectTranscript(v);
}

export async function extractTranscript(videoId: string): Promise<TranscriptExtractionResult> {
  const prisma = getPrisma();

  const video = await prisma.video.findFirst({
    where: { id: videoId, deletedAt: null },
  });
  if (!video) {
    return { success: false, message: 'Vídeo não encontrado.' };
  }

  let fetched;
  try {
    fetched = await provider.fetch({
      youtubeId: video.youtubeId,
      durationSec: video.durationSec,
    });
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha ao extrair transcrição.',
    };
  }

  const updated = await prisma.video.update({
    where: { id: videoId },
    data: {
      transcriptStatus: fetched.status,
      transcriptLanguage: fetched.language,
      transcriptSegments:
        fetched.status === 'available' ? JSON.stringify(fetched.segments) : null,
      transcriptExtractedAt: new Date(),
    },
  });

  const transcript = projectTranscript(updated);
  return {
    success: true,
    message:
      fetched.status === 'available'
        ? 'Transcrição extraída e salva localmente.'
        : 'Vídeo sem transcrição disponível (sem legendas nativas).',
    transcript: transcript ?? undefined,
  };
}

export async function exportTranscript(
  videoId: string,
  format: TranscriptExportFormat
): Promise<TranscriptExportResult> {
  const transcript = await getTranscript(videoId);
  if (!transcript || transcript.status !== 'available') {
    return { success: false, message: 'Sem transcrição disponível pra exportar.' };
  }

  const slug = transcript.youtubeId.slice(0, 11).replace(/[^A-Za-z0-9-_]/g, '');
  const result = await dialog.showSaveDialog({
    title: 'Salvar transcrição',
    defaultPath: `transcricao-${slug}.${format}`,
    filters: [
      { name: format.toUpperCase(), extensions: [format] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, message: 'Exportação cancelada.' };
  }

  const content = format === 'md' ? buildMarkdown(transcript) : buildPlainText(transcript);
  await writeFile(result.filePath, content, 'utf-8');

  return { success: true, message: 'Salvo com sucesso.', path: result.filePath };
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function buildPlainText(t: VideoTranscript): string {
  const header = [
    `Transcrição extraída via isiTube`,
    `Vídeo: https://www.youtube.com/watch?v=${t.youtubeId}`,
    `Idioma: ${t.language ?? 'desconhecido'}`,
    `Extraída em: ${t.extractedAt ?? '—'}`,
    '',
    '---',
    '',
  ].join('\n');
  const body = t.segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n');
  return header + body + '\n';
}

function buildMarkdown(t: VideoTranscript): string {
  const header = [
    `# Transcrição`,
    '',
    `**Vídeo:** https://www.youtube.com/watch?v=${t.youtubeId}`,
    `**Idioma:** ${t.language ?? 'desconhecido'}`,
    `**Extraída em:** ${t.extractedAt ?? '—'}`,
    '',
    '---',
    '',
  ].join('\n');
  const body = t.segments
    .map((s) => `**[${formatTimestamp(s.start)}]** ${s.text}`)
    .join('\n\n');
  return header + body + '\n';
}
