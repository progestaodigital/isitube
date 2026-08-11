import type { VideoDetail } from '@shared/types';
import { csvDate, type CsvCell } from './csv';

/**
 * Single source of truth for the columns used when exporting videos — both the
 * Biblioteca and the "Vídeos" (avulsos) pages share this so CSV and JSON never
 * drift apart. Field keys are pt-BR snake_case (same convention as the other
 * CSV exports in the app) and double as JSON object keys.
 *
 * `csv` produces a spreadsheet-friendly cell (dates humanized, tags joined,
 * booleans as sim/não). `json` keeps native types (numbers, arrays, booleans,
 * ISO dates) so the JSON export stays lossless and machine-readable.
 */
type ExportField = {
  key: string;
  csv: (v: VideoDetail) => CsvCell;
  json: (v: VideoDetail) => unknown;
};

const yesNo = (b: boolean | null | undefined): string => (b ? 'sim' : 'não');

const youtubeUrl = (v: VideoDetail): string =>
  `https://www.youtube.com/watch?v=${v.youtubeId}`;

const FIELDS: ExportField[] = [
  { key: 'id', csv: (v) => v.id, json: (v) => v.id },
  { key: 'youtube_id', csv: (v) => v.youtubeId, json: (v) => v.youtubeId },
  { key: 'titulo', csv: (v) => v.title, json: (v) => v.title },
  { key: 'canal', csv: (v) => v.channelTitle ?? '', json: (v) => v.channelTitle ?? null },
  { key: 'views', csv: (v) => v.viewCount, json: (v) => v.viewCount },
  { key: 'likes', csv: (v) => v.likeCount, json: (v) => v.likeCount },
  { key: 'comentarios', csv: (v) => v.commentCount, json: (v) => v.commentCount },
  { key: 'duracao_seg', csv: (v) => v.durationSec, json: (v) => v.durationSec },
  { key: 'publicado_em', csv: (v) => csvDate(v.publishedAt), json: (v) => v.publishedAt },
  {
    key: 'media_canal',
    csv: (v) => v.channelAvgViewsAtCheck,
    json: (v) => v.channelAvgViewsAtCheck,
  },
  {
    key: 'percentual_outlier',
    csv: (v) => (v.outlierPercent != null ? Math.round(v.outlierPercent) : null),
    json: (v) => v.outlierPercent,
  },
  { key: 'destaque', csv: (v) => yesNo(v.flaggedAsOutlier), json: (v) => v.flaggedAsOutlier },
  { key: 'categoria', csv: (v) => v.category ?? '', json: (v) => v.category },
  { key: 'idioma', csv: (v) => v.language ?? '', json: (v) => v.language },
  { key: 'tags', csv: (v) => (v.tags ? v.tags.join(', ') : ''), json: (v) => v.tags ?? [] },
  { key: 'descricao', csv: (v) => v.description ?? '', json: (v) => v.description },
  {
    key: 'transcricao_status',
    csv: (v) => v.transcriptStatus ?? '',
    json: (v) => v.transcriptStatus,
  },
  {
    key: 'transcricao_idioma',
    csv: (v) => v.transcriptLanguage ?? '',
    json: (v) => v.transcriptLanguage,
  },
  {
    key: 'metadata_extraida_em',
    csv: (v) => csvDate(v.metadataExtractedAt),
    json: (v) => v.metadataExtractedAt,
  },
  {
    key: 'transcricao_extraida_em',
    csv: (v) => csvDate(v.transcriptExtractedAt),
    json: (v) => v.transcriptExtractedAt,
  },
  { key: 'na_biblioteca', csv: (v) => yesNo(v.inLibrary), json: (v) => v.inLibrary ?? false },
  {
    key: 'adicionado_biblioteca_em',
    csv: (v) => csvDate(v.libraryAddedAt ?? null),
    json: (v) => v.libraryAddedAt ?? null,
  },
  { key: 'anotacao', csv: (v) => v.libraryNotes ?? '', json: (v) => v.libraryNotes },
  { key: 'thumbnail_url', csv: (v) => v.thumbnailUrl ?? '', json: (v) => v.thumbnailUrl },
  { key: 'youtube_url', csv: youtubeUrl, json: youtubeUrl },
];

/** Column headers for the CSV export, in fixed order. */
export const videoExportHeaders: string[] = FIELDS.map((f) => f.key);

/** One CSV row (spreadsheet-friendly cells) for a single video. */
export function videoExportRow(v: VideoDetail): CsvCell[] {
  return FIELDS.map((f) => f.csv(v));
}

/** One JSON object (native types, lossless) for a single video. */
export function videoExportObject(v: VideoDetail): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const f of FIELDS) obj[f.key] = f.json(v);
  return obj;
}
