import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, Users, Eye, Filter as FilterIcon } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Checkbox } from '../../components/ui/Checkbox';
import { CHART_PALETTE, LineChart, type LineSeries } from '../../components/charts/LineChart';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import type { ChannelTimeSeriesPayload } from '@shared/types';

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
];

type Smoothing = 'none' | 'avg7';

interface AnalyticsTabProps {
  categoryIds?: string[];
}

export function AnalyticsTab({ categoryIds = [] }: AnalyticsTabProps) {
  const [daysBack, setDaysBack] = useState(30);
  const [totalViews, setTotalViews] = useState<ChannelTimeSeriesPayload | null>(null);
  const [viewsPerDay, setViewsPerDay] = useState<ChannelTimeSeriesPayload | null>(null);
  const [subscribers, setSubscribers] = useState<ChannelTimeSeriesPayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Per-channel selection: undefined = all, otherwise just the listed ids.
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());
  const [smoothing, setSmoothing] = useState<Smoothing>('none');

  // Stable string key so the effect dep changes only when the list contents change.
  const catKey = categoryIds.join(',');

  const refresh = useCallback(
    async (days: number) => {
      setLoading(true);
      try {
        const [tv, vpd, subs] = await Promise.all([
          window.api.channels.analyticsTimeSeries('totalViews', days, categoryIds),
          window.api.channels.analyticsTimeSeries('viewsPerDay', days, categoryIds),
          window.api.channels.analyticsTimeSeries('subscribers', days, categoryIds),
        ]);
        setTotalViews(tv);
        setViewsPerDay(vpd);
        setSubscribers(subs);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [catKey]
  );

  useEffect(() => {
    refresh(daysBack);
  }, [daysBack, refresh]);

  // Refresh whenever an update run completes — new snapshots may have been written.
  useEffect(() => {
    const off = window.api.events.onUpdateRunCompleted(() => refresh(daysBack));
    return off;
  }, [daysBack, refresh]);

  // Build canonical channel list from any of the payloads (they share the same set).
  const channelList = useMemo(() => {
    const source = totalViews ?? viewsPerDay ?? subscribers;
    if (!source) return [] as Array<{ id: string; title: string; color: string }>;
    return source.series.map((s, i) => ({
      id: s.channelId,
      title: s.channelTitle,
      color: CHART_PALETTE[i % CHART_PALETTE.length]!,
    }));
  }, [totalViews, viewsPerDay, subscribers]);

  function toggleChannel(id: string) {
    setHiddenChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function showAll() {
    setHiddenChannels(new Set());
  }

  function hideAll() {
    setHiddenChannels(new Set(channelList.map((c) => c.id)));
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Comparativo entre canais · cada ponto = um "Atualizar agora" passado
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Suavização</span>
            <select
              value={smoothing}
              onChange={(e) => setSmoothing(e.target.value as Smoothing)}
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="none">Bruto</option>
              <option value="avg7">Média móvel 7 pontos</option>
            </select>
          </div>
          <div className="flex gap-1 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setDaysBack(r.days)}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                  (daysBack === r.days
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100')
                }
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {channelList.length > 0 && (
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterIcon className="h-4 w-4 text-zinc-500" />
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Canais no gráfico
            </span>
            <button
              onClick={showAll}
              className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Mostrar todos
            </button>
            <button
              onClick={hideAll}
              className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Esconder todos
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {channelList.map((c) => {
              const visible = !hiddenChannels.has(c.id);
              return (
                <label
                  key={c.id}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors',
                    visible
                      ? 'border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                      : 'border-zinc-200 bg-zinc-100 opacity-60 dark:border-zinc-800 dark:bg-zinc-800/50'
                  )}
                >
                  <Checkbox
                    checked={visible}
                    onChange={() => toggleChannel(c.id)}
                    ariaLabel={c.title}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>{c.title}</span>
                </label>
              );
            })}
          </div>
        </Card>
      )}

      <ChartCard
        title="Crescimento total de views"
        subtitle="Total de views acumulados por canal ao longo do tempo (vem da YouTube Data API)."
        icon={Eye}
        payload={totalViews}
        hiddenChannels={hiddenChannels}
        smoothing={smoothing}
        loading={loading}
      />

      <ChartCard
        title="Views por dia"
        subtitle="Taxa diária de novas views — calculada como diferença entre snapshots consecutivos. Precisa de pelo menos 2 atualizações pra mostrar algo."
        icon={TrendingUp}
        payload={viewsPerDay}
        hiddenChannels={hiddenChannels}
        smoothing={smoothing}
        loading={loading}
      />

      <ChartCard
        title="Inscritos"
        subtitle="Crescimento (ou queda) de inscritos por canal."
        icon={Users}
        payload={subscribers}
        hiddenChannels={hiddenChannels}
        smoothing={smoothing}
        loading={loading}
      />
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  payload,
  hiddenChannels,
  smoothing,
  loading,
}: {
  title: string;
  subtitle: string;
  icon: typeof Eye;
  payload: ChannelTimeSeriesPayload | null;
  hiddenChannels: Set<string>;
  smoothing: Smoothing;
  loading: boolean;
}) {
  const series: LineSeries[] = useMemo(() => {
    if (!payload) return [];
    return payload.series
      .filter((s) => !hiddenChannels.has(s.channelId))
      .map((s, i) => ({
        id: s.channelId,
        label: s.channelTitle,
        color: pickColor(payload, s.channelId, i),
        points:
          smoothing === 'avg7'
            ? rollingAverage(s.points, 7)
            : s.points,
      }));
  }, [payload, hiddenChannels, smoothing]);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">
        {loading && !payload ? (
          <div className="space-y-3">
            <Skeleton className="h-[260px] w-full rounded-lg" />
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ) : (
          <LineChart series={series} formatY={formatCompact} />
        )}
      </div>
    </Card>
  );
}

/**
 * Pick a stable color per channel by mapping the channel id to its index in
 * the original (unfiltered) payload, so colors stay consistent even when the
 * user hides some channels.
 */
function pickColor(payload: ChannelTimeSeriesPayload, channelId: string, fallback: number): string {
  const originalIndex = payload.series.findIndex((s) => s.channelId === channelId);
  const idx = originalIndex >= 0 ? originalIndex : fallback;
  return CHART_PALETTE[idx % CHART_PALETTE.length]!;
}

function rollingAverage(
  points: Array<{ date: string; value: number | null }>,
  window: number
): Array<{ date: string; value: number | null }> {
  const out: Array<{ date: string; value: number | null }> = [];
  for (let i = 0; i < points.length; i++) {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    const valid = slice.filter((p) => p.value !== null) as Array<{
      date: string;
      value: number;
    }>;
    if (valid.length === 0) {
      out.push({ date: points[i]!.date, value: null });
    } else {
      const avg = valid.reduce((s, p) => s + p.value, 0) / valid.length;
      out.push({ date: points[i]!.date, value: Math.round(avg) });
    }
  }
  return out;
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
}
