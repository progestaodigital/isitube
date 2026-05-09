import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Flame, Download } from 'lucide-react';
import { VideoCard } from './VideoCard';
import { exportCsv } from '../../lib/exportCsv';
import type { ChannelInfo, FlaggedVideosFilters, VideoInfo } from '@shared/types';

interface FlaggedVideosListProps {
  videos: VideoInfo[];
  channels: ChannelInfo[];
  filters: FlaggedVideosFilters;
  onFilterChange: (next: FlaggedVideosFilters) => void;
  onDeleteVideo?: (videoId: string) => void;
}

export function FlaggedVideosList({
  videos,
  channels,
  filters,
  onFilterChange,
  onDeleteVideo,
}: FlaggedVideosListProps) {
  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <Filter label="Canal">
            <select
              value={filters.channelId ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  channelId: e.target.value || undefined,
                })
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Todos</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Filter>

          <Filter label="Período">
            <select
              value={filters.sinceDays ?? 30}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  sinceDays: Number(e.target.value),
                })
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              title="A média do canal é calculada nessa mesma janela"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </select>
          </Filter>

          <Filter label="% mínimo">
            <select
              value={filters.minPercent ?? 150}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  minPercent: Number(e.target.value),
                })
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="150">≥ 150% da média</option>
              <option value="200">≥ 200% (2x)</option>
              <option value="300">≥ 300% (3x)</option>
              <option value="500">≥ 500% (5x)</option>
            </select>
          </Filter>

          <Filter label="Tipo">
            <select
              value={filters.videoType ?? 'all'}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  videoType: e.target.value as 'all' | 'shorts' | 'long',
                })
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">Todos</option>
              <option value="shorts">Shorts (≤ 3min)</option>
              <option value="long">Vídeos longos (&gt; 3min)</option>
            </select>
          </Filter>
          <Button
            onClick={() => exportFlaggedCsv(videos)}
            variant="ghost"
            size="sm"
            className="ml-auto"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          Cada vídeo é comparado com a média de views do mesmo canal{' '}
          <b>na mesma janela escolhida</b>. Mude o período e a média recalcula.
        </p>
      </Card>

      {videos.length === 0 ? (
        <Card className="py-16 text-center">
          <Flame className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium">Nenhum vídeo sinalizado</p>
          <p className="mt-1 text-xs text-zinc-500">
            Cadastre canais e clique em "Atualizar agora" pra coletar dados.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} onDelete={onDeleteVideo} />
          ))}
        </div>
      )}
    </div>
  );
}

function exportFlaggedCsv(videos: VideoInfo[]) {
  exportCsv(
    'videos-em-destaque',
    [
      'id',
      'youtube_id',
      'titulo',
      'canal',
      'views',
      'likes',
      'comentarios',
      'duracao_seg',
      'publicado_em',
      'media_canal',
      'percentual_outlier',
      'youtube_url',
    ],
    videos.map((v) => [
      v.id,
      v.youtubeId,
      v.title,
      v.channelTitle ?? '',
      v.viewCount,
      v.likeCount,
      v.commentCount,
      v.durationSec,
      v.publishedAt,
      v.channelAvgViewsAtCheck,
      v.outlierPercent ? Math.round(v.outlierPercent) : null,
      `https://www.youtube.com/watch?v=${v.youtubeId}`,
    ])
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
