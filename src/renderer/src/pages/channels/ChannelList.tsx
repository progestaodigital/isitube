import { useEffect, useState } from 'react';
import {
  Trash2,
  Users,
  Video as VideoIcon,
  AlertTriangle,
  Eye,
  Download,
  Tag,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { CategoryBadge } from '../../components/categories/CategoryBadge';
import { exportCsv } from '../../lib/exportCsv';
import type { ChannelInfo } from '@shared/types';

interface ChannelListProps {
  channels: ChannelInfo[];
  onRemove: (channelId: string) => void;
  onBulkRemove: (channelIds: string[]) => Promise<void> | void;
  onEditCategories: (channel: ChannelInfo) => void;
  removing: Set<string>;
}

export function ChannelList({
  channels,
  onRemove,
  onBulkRemove,
  onEditCategories,
  removing,
}: ChannelListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drop selections that no longer exist (after deletion or filter change).
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const c of channels) if (prev.has(c.id)) next.add(c.id);
      return next;
    });
  }, [channels]);

  if (channels.length === 0) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm font-medium">Nenhum canal cadastrado ainda</p>
        <p className="mt-1 text-xs text-zinc-500">
          Use "Cadastrar canal" no topo da página.
        </p>
      </Card>
    );
  }

  const allSelected = selected.size === channels.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(channels.map((c) => c.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Apagar ${ids.length} canal${ids.length > 1 ? 'is' : ''}? Os vídeos coletados serão preservados.`
    );
    if (!ok) return;
    await onBulkRemove(ids);
    setSelected(new Set());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <label className="flex cursor-pointer items-center gap-3">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleAll}
            ariaLabel="Selecionar todos os canais"
          />
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {selected.size > 0
              ? `${selected.size} de ${channels.length} selecionado${selected.size > 1 ? 's' : ''}`
              : `${channels.length} canal${channels.length > 1 ? 'is' : ''} · selecionar todos`}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <Button onClick={() => handleExport(channels)} variant="ghost" size="sm">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          {selected.size > 0 && (
            <Button onClick={bulkDelete} variant="primary" size="sm">
              <Trash2 className="h-4 w-4" />
              Apagar {selected.size}
            </Button>
          )}
        </div>
      </div>

      {channels.map((c) => {
        const isSelected = selected.has(c.id);
        const isRemoving = removing.has(c.id);
        return (
          <Card key={c.id} className={isSelected ? 'ring-2 ring-red-500/40' : undefined}>
            <div className="flex items-center gap-4">
              <Checkbox
                checked={isSelected}
                onChange={() => toggle(c.id)}
                ariaLabel={`Selecionar ${c.title}`}
              />
              {c.thumbnailUrl && (
                <img
                  src={c.thumbnailUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title}</p>
                <p className="font-mono text-[11px] text-zinc-500">{c.youtubeId}</p>
                {c.categories.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {c.categories.map((cat) => (
                      <CategoryBadge
                        key={cat.id}
                        name={cat.name}
                        color={cat.color}
                        size="xs"
                      />
                    ))}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <Stat
                    icon={Users}
                    text={
                      c.subscriberCount
                        ? `${formatCompact(c.subscriberCount)} inscritos`
                        : '—'
                    }
                  />
                  <Stat icon={VideoIcon} text={`${c.videoCountTracked} vídeos rastreados`} />
                  {c.recentAverageViews !== null && c.recentVideoCount > 0 && (
                    <Stat
                      icon={Eye}
                      text={`média ${formatCompact(c.recentAverageViews)} (${c.recentVideoCount} vídeo${c.recentVideoCount > 1 ? 's' : ''} nos últimos ${c.lookbackDays} dias)`}
                    />
                  )}
                  {c.flaggedCount > 0 && (
                    <Stat
                      icon={AlertTriangle}
                      text={`${c.flaggedCount} sinalizado${c.flaggedCount > 1 ? 's' : ''}`}
                      accent="text-amber-600 dark:text-amber-400"
                    />
                  )}
                  <span>
                    {c.lastUpdatedAt
                      ? `atualizado ${formatRelative(c.lastUpdatedAt)}`
                      : 'nunca atualizado'}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => onEditCategories(c)}
                variant="ghost"
                size="sm"
                title="Editar categorias"
              >
                <Tag className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => onRemove(c.id)}
                disabled={isRemoving}
                variant="ghost"
                size="sm"
                title="Remover canal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({
  icon: Icon,
  text,
  accent,
}: {
  icon: typeof Users;
  text: string;
  accent?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${accent ?? ''}`}>
      <Icon className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function handleExport(channels: ChannelInfo[]) {
  exportCsv(
    'canais',
    [
      'id',
      'youtube_id',
      'titulo',
      'inscritos',
      'video_count_youtube',
      'total_views',
      'video_count_rastreado',
      'em_destaque',
      'media_views_recente',
      'videos_recente',
      'lookback_dias',
      'monitorando',
      'ultima_atualizacao',
    ],
    channels.map((c) => [
      c.id,
      c.youtubeId,
      c.title,
      c.subscriberCount,
      c.videoCount,
      c.totalViewCount,
      c.videoCountTracked,
      c.flaggedCount,
      c.recentAverageViews,
      c.recentVideoCount,
      c.lookbackDays,
      c.monitored ? 'sim' : 'não',
      c.lastUpdatedAt,
    ])
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'agora há pouco';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}
