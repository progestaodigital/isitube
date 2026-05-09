import { useCallback, useEffect, useRef, useState } from 'react';
import { Sprout, TrendingUp, Calendar, Eye, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { SkeletonListRow } from '../../components/ui/Skeleton';
import { useVideoDetailStore } from '../../stores/videoDetail';
import type { ChannelInfo, EvergreenFilters, EvergreenVideo } from '@shared/types';

interface EvergreenTabProps {
  channels: ChannelInfo[];
  categoryIds?: string[];
}

export function EvergreenTab({ channels, categoryIds = [] }: EvergreenTabProps) {
  const openDetail = useVideoDetailStore((s) => s.open);

  const [items, setItems] = useState<EvergreenVideo[]>([]);
  const [filters, setFilters] = useState<EvergreenFilters>({
    minAgeDays: 30,
    lookbackDays: 30,
    minViewsPerDay: 10,
    videoType: 'all',
    sort: 'viewsPerDay',
  });
  const [titleInput, setTitleInput] = useState('');
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce title typing so we don't requery on every keystroke.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, titleQuery: titleInput.trim() || undefined }));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [titleInput]);

  const catKey = categoryIds.join(',');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await window.api.channels.analyticsEvergreen({
          ...filters,
          categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        })
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, catKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const off = window.api.events.onUpdateRunCompleted(() => refresh());
    return off;
  }, [refresh]);

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Sprout className="h-4 w-4 text-emerald-500" />
          <p className="text-xs text-zinc-700 dark:text-zinc-300">
            Vídeos antigos que continuam ganhando views — ranking pela média de views/dia recente.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <FilterField label="Canal">
            <select
              value={filters.channelId ?? ''}
              onChange={(e) =>
                setFilters((f) => ({ ...f, channelId: e.target.value || undefined }))
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
          </FilterField>
          <FilterField label="Idade mínima">
            <select
              value={filters.minAgeDays ?? 30}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minAgeDays: Number(e.target.value) }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="14">≥ 14 dias</option>
              <option value="30">≥ 30 dias</option>
              <option value="90">≥ 90 dias</option>
              <option value="365">≥ 1 ano</option>
            </select>
          </FilterField>
          <FilterField label="Janela">
            <select
              value={filters.lookbackDays ?? 30}
              onChange={(e) =>
                setFilters((f) => ({ ...f, lookbackDays: Number(e.target.value) }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
            </select>
          </FilterField>
          <FilterField label="Views/dia mínimo">
            <select
              value={filters.minViewsPerDay ?? 10}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minViewsPerDay: Number(e.target.value) }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="1">≥ 1/dia</option>
              <option value="10">≥ 10/dia</option>
              <option value="50">≥ 50/dia</option>
              <option value="100">≥ 100/dia</option>
              <option value="500">≥ 500/dia</option>
            </select>
          </FilterField>
          <FilterField label="Tipo">
            <select
              value={filters.videoType ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  videoType: e.target.value as 'all' | 'shorts' | 'long',
                }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">Todos</option>
              <option value="shorts">Shorts (≤ 3min)</option>
              <option value="long">Vídeos longos (&gt; 3min)</option>
            </select>
          </FilterField>
          <FilterField label="Ordenar">
            <select
              value={filters.sort ?? 'viewsPerDay'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sort: e.target.value as EvergreenFilters['sort'],
                }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="viewsPerDay">Views/dia (maior)</option>
              <option value="totalViews">Views totais (maior)</option>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
            </select>
          </FilterField>
        </div>
        <div className="mt-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Buscar por título do vídeo..."
              className="h-8 pl-9 text-xs"
            />
          </div>
        </div>
      </Card>

      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonListRow key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-16 text-center">
          <Sprout className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium">Nenhum vídeo evergreen no momento</p>
          <p className="mt-1 text-xs text-zinc-500">
            Pode ser falta de histórico (precisa de pelo menos 2 atualizações pra calcular
            views/dia recente) ou os filtros estão muito apertados. Tenta diminuir o "views/dia
            mínimo".
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((v, idx) => (
            <button
              key={v.id}
              onClick={() => openDetail(v.id)}
              className="flex w-full gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex w-8 shrink-0 items-center justify-center text-sm font-mono font-semibold text-zinc-400">
                {idx + 1}
              </div>
              {v.thumbnailUrl && (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="h-16 w-28 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{v.channelTitle}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatCompact(v.totalViewCount)} views totais
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    publicado {formatRelativeDays(v.publishedAt)}
                  </span>
                  {v.basedOn === 'all-time' && (
                    <span className="text-amber-600 dark:text-amber-400">
                      média all-time (sem snapshot recente)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  {formatCompact(v.viewsPerDay)}/dia
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
}

function formatRelativeDays(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 30) return `há ${days} dias`;
  if (days < 365) return `há ${Math.round(days / 30)} meses`;
  return `há ${Math.round(days / 365)} ano${days >= 730 ? 's' : ''}`;
}
