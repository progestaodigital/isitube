import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
  Eye,
  ThumbsUp,
  MessageCircle,
  Calendar,
  Clock,
  Flame,
  Tag,
  PlayCircle,
  ExternalLink,
  Copy,
  FileText,
  FileCode,
  Captions,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useVideoDetailStore } from '../../stores/videoDetail';
import { useToastStore } from '../../stores/toast';
import { useLookbackDays } from '../../hooks/useLookbackDays';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import type {
  TranscriptExportFormat,
  VideoDetail,
  VideoTranscript,
} from '@shared/types';

export function VideoDetailModal() {
  const videoId = useVideoDetailStore((s) => s.videoId);
  const close = useVideoDetailStore((s) => s.close);
  const showToast = useToastStore((s) => s.show);
  const lookbackDays = useLookbackDays();

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [transcript, setTranscript] = useState<VideoTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractingTranscript, setExtractingTranscript] = useState(false);

  const refresh = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [v, t] = await Promise.all([
        window.api.videos.getDetail(id),
        window.api.transcripts.get(id),
      ]);
      setVideo(v);
      setTranscript(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!videoId) {
      setVideo(null);
      setTranscript(null);
      return;
    }
    refresh(videoId);
  }, [videoId, refresh]);

  async function handleExtract() {
    if (!videoId || extracting) return;
    setExtracting(true);
    try {
      const res = await window.api.videos.extractMetadata(videoId);
      if (res.success && res.video) {
        setVideo(res.video);
        showToast({ kind: 'success', title: 'Metadata extraída' });
      } else {
        showToast({ kind: 'error', title: 'Falha na extração', description: res.message });
      }
    } finally {
      setExtracting(false);
    }
  }

  async function handleExtractTranscript() {
    if (!videoId || extractingTranscript) return;
    setExtractingTranscript(true);
    try {
      const res = await window.api.transcripts.extract(videoId);
      if (res.success && res.transcript) {
        setTranscript(res.transcript);
        // refresh video so transcriptStatus updates in the parent
        const v = await window.api.videos.getDetail(videoId);
        setVideo(v);
        showToast({
          kind: res.transcript.status === 'available' ? 'success' : 'info',
          title:
            res.transcript.status === 'available'
              ? 'Transcrição extraída'
              : 'Vídeo sem transcrição',
          description: res.message,
        });
      } else {
        showToast({ kind: 'error', title: 'Falha', description: res.message });
      }
    } finally {
      setExtractingTranscript(false);
    }
  }

  async function handleCopyTranscript() {
    if (!transcript || transcript.segments.length === 0) return;
    const text = transcript.segments
      .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        kind: 'success',
        title: 'Copiado',
        description: `${transcript.segments.length} segmentos copiados.`,
      });
    } catch {
      showToast({ kind: 'error', title: 'Falha ao copiar' });
    }
  }

  async function handleExportTranscript(format: TranscriptExportFormat) {
    if (!videoId) return;
    const res = await window.api.transcripts.export(videoId, format);
    if (res.success && res.path) {
      showToast({ kind: 'success', title: 'Salvo', description: res.path });
    } else if (res.message !== 'Exportação cancelada.') {
      showToast({ kind: 'error', title: 'Falha', description: res.message });
    }
  }

  if (!videoId) return null;

  const hasMetadata = Boolean(video?.metadataExtractedAt);
  const thumb = video?.thumbnailHdUrl ?? video?.thumbnailUrl ?? null;
  const outlierPct = video?.outlierPercent ?? 0;

  return (
    <Modal open={Boolean(videoId)} onClose={close} size="xl">
      {loading && !video ? (
        <div className="space-y-5">
          <header className="flex items-start gap-4">
            <Skeleton className="h-32 w-56 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </header>
          <Skeleton className="h-10 w-44 rounded-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : !video ? (
        <p className="py-8 text-center text-sm text-red-500">Vídeo não encontrado.</p>
      ) : (
        <div className="space-y-5">
          <header className="flex items-start gap-4">
            {thumb && (
              <a
                href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-video h-32 shrink-0 overflow-hidden rounded-xl"
                title="Abrir vídeo no YouTube"
              >
                <img src={thumb} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
                  <PlayCircle className="h-10 w-10 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </a>
            )}
            <div className="min-w-0 flex-1 pr-8">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Vídeo</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight">{video.title}</h2>
              {video.channelTitle && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {video.channelTitle}
                </p>
              )}
              {video.flaggedAsOutlier && (
                <span
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  title={`A média do canal nos últimos ${lookbackDays} dias é ${video.channelAvgViewsAtCheck ?? '—'}. Esse vídeo tem ${Math.round(outlierPct)}% disso.`}
                >
                  <Flame className="h-3 w-3" />
                  Outlier · {Math.round(outlierPct)}% da média (últimos {lookbackDays} dias)
                </span>
              )}
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <PlayCircle className="h-4 w-4" />
              Assistir no YouTube
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat icon={Eye} label="Visualizações" value={formatCompact(video.viewCount)} />
            {video.likeCount !== null && (
              <Stat icon={ThumbsUp} label="Likes" value={formatCompact(video.likeCount)} />
            )}
            {video.commentCount !== null && (
              <Stat icon={MessageCircle} label="Comentários" value={formatCompact(video.commentCount)} />
            )}
            {video.durationSec !== null && (
              <Stat icon={Clock} label="Duração" value={formatDuration(video.durationSec)} />
            )}
            <Stat icon={Calendar} label="Publicado" value={new Date(video.publishedAt).toLocaleDateString('pt-BR')} />
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Informações completas</p>
                <p className="text-xs text-zinc-500">
                  {hasMetadata
                    ? `Extraído em ${new Date(video.metadataExtractedAt!).toLocaleString('pt-BR')}`
                    : 'Ainda não extraído. Clica no botão pra baixar tudo.'}
                </p>
              </div>
              <Button
                onClick={handleExtract}
                disabled={extracting}
                variant={hasMetadata ? 'secondary' : 'primary'}
                size="sm"
              >
                {extracting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : hasMetadata ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {extracting ? 'Extraindo...' : hasMetadata ? 'Re-extrair' : 'Extrair informações'}
              </Button>
            </div>
          </div>

          <TranscriptPanel
            videoYoutubeId={video.youtubeId}
            transcript={transcript}
            extracting={extractingTranscript}
            onExtract={handleExtractTranscript}
            onCopy={handleCopyTranscript}
            onExport={handleExportTranscript}
          />

          {hasMetadata && (
            <>
              {video.description && (
                <Section title="Descrição">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-zinc-700 dark:text-zinc-300">
                    {video.description}
                  </pre>
                </Section>
              )}

              {video.tags && video.tags.length > 0 && (
                <Section title="Tags públicas" icon={Tag}>
                  <div className="flex flex-wrap gap-1.5">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {video.category && <KV label="Categoria" value={video.category} />}
                {video.language && <KV label="Idioma" value={video.language} />}
                {video.liveBroadcastStatus && (
                  <KV label="Tipo" value={liveBroadcastLabel(video.liveBroadcastStatus)} />
                )}
              </div>

              <p className="font-mono text-[11px] text-zinc-500">
                youtube id: {video.youtubeId}
              </p>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function TranscriptPanel({
  videoYoutubeId,
  transcript,
  extracting,
  onExtract,
  onCopy,
  onExport,
}: {
  videoYoutubeId: string;
  transcript: VideoTranscript | null;
  extracting: boolean;
  onExtract: () => void;
  onCopy: () => void;
  onExport: (format: TranscriptExportFormat) => void;
}) {
  const status = transcript?.status ?? null;

  // Never extracted
  if (!transcript) {
    return (
      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Captions className="h-4 w-4 text-zinc-500" />
            <div>
              <p className="text-sm font-semibold">Transcrição</p>
              <p className="text-xs text-zinc-500">
                Ainda não extraída. Vamos abrir o vídeo numa janela invisível e ler o painel
                de transcrição do YouTube.
              </p>
            </div>
          </div>
          <Button onClick={onExtract} disabled={extracting} variant="primary" size="sm">
            {extracting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {extracting ? 'Extraindo...' : 'Extrair transcrição'}
          </Button>
        </div>
      </div>
    );
  }

  // Extracted but unavailable
  if (status === 'unavailable') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-semibold">Vídeo sem transcrição disponível</p>
              <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
                Tentamos abrir e ler o painel de transcrição mas esse vídeo não tem legendas
                nativas. Whisper como fallback automático chega na v2.
              </p>
              {transcript.extractedAt && (
                <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300/70">
                  Última tentativa: {new Date(transcript.extractedAt).toLocaleString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <Button onClick={onExtract} disabled={extracting} variant="secondary" size="sm">
            {extracting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Tentar de novo
          </Button>
        </div>
      </div>
    );
  }

  // Available
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Captions className="h-4 w-4 text-zinc-500" />
          <p className="text-sm font-semibold">Transcrição</p>
          {transcript.language && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {transcript.language}
            </span>
          )}
          <span className="text-[11px] text-zinc-500">
            {transcript.segments.length} segmentos
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button onClick={onCopy} variant="secondary" size="sm">
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
          <Button onClick={() => onExport('txt')} variant="secondary" size="sm">
            <FileText className="h-3.5 w-3.5" />
            TXT
          </Button>
          <Button onClick={() => onExport('md')} variant="secondary" size="sm">
            <FileCode className="h-3.5 w-3.5" />
            MD
          </Button>
          <Button onClick={onExtract} disabled={extracting} variant="ghost" size="sm">
            {extracting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      {transcript.extractedAt && (
        <p className="border-b border-zinc-200 px-4 py-1.5 text-[11px] text-zinc-500 dark:border-zinc-800">
          Extraída em {new Date(transcript.extractedAt).toLocaleString('pt-BR')}
        </p>
      )}
      <div className="max-h-[320px] overflow-y-auto px-2 py-2">
        {transcript.segments.map((s, i) => (
          <a
            key={i}
            href={`https://www.youtube.com/watch?v=${videoYoutubeId}&t=${Math.floor(s.start)}s`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
          >
            <span className="shrink-0 font-mono text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              {formatTimestamp(s.start)}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">{s.text}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Tag;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800/50">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function liveBroadcastLabel(status: string): string {
  switch (status) {
    case 'live':
      return 'Ao vivo';
    case 'upcoming':
      return 'Próxima live';
    default:
      return 'Vídeo gravado';
  }
}

void cn;
