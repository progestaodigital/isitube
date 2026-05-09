import { Eye, ThumbsUp, Calendar, Flame, ExternalLink } from 'lucide-react';
import type { VideoInfo } from '@shared/types';
import { useVideoDetailStore } from '../../stores/videoDetail';
import { useLookbackDays } from '../../hooks/useLookbackDays';
import { cn } from '../../lib/cn';

interface VideoCardProps {
  video: VideoInfo;
}

export function VideoCard({ video }: VideoCardProps) {
  const open = useVideoDetailStore((s) => s.open);
  const lookbackDays = useLookbackDays();
  const pct = video.outlierPercent ?? 0;
  const badgeClass =
    pct >= 500
      ? 'bg-red-600 text-white'
      : pct >= 300
        ? 'bg-amber-500 text-white'
        : 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300';

  return (
    <button
      onClick={() => open(video.id)}
      className="group flex w-full gap-4 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      {video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt=""
          className="h-16 w-28 shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            {video.flaggedAsOutlier && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  badgeClass
                )}
              >
                <Flame className="h-3 w-3" />
                {Math.round(pct)}%
              </span>
            )}
            <ExternalLink className="h-4 w-4 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </div>
        {video.channelTitle && (
          <p className="mt-0.5 text-xs text-zinc-500">{video.channelTitle}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          <Stat icon={Eye} text={`${formatCompact(video.viewCount)} views`} />
          {video.likeCount !== null && (
            <Stat icon={ThumbsUp} text={`${formatCompact(video.likeCount)}`} />
          )}
          <Stat icon={Calendar} text={formatRelativeDate(video.publishedAt)} />
          {video.channelAvgViewsAtCheck && video.channelAvgViewsAtCheck > 0 && (
            <span className="text-zinc-500">
              média do canal nos últimos {lookbackDays} dias:{' '}
              {formatCompact(video.channelAvgViewsAtCheck)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Stat({ icon: Icon, text }: { icon: typeof Eye; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatRelativeDate(iso: string): string {
  const diffDays = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays < 1) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `${diffDays} dias atrás`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)} meses atrás`;
  return `${Math.round(diffDays / 365)} ano${diffDays >= 730 ? 's' : ''} atrás`;
}
