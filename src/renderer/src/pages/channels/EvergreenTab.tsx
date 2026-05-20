import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sprout,
  TrendingUp,
  Calendar,
  Eye,
  Search,
  Trash2,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { SkeletonListRow } from '../../components/ui/Skeleton';
import { useVideoDetailStore } from '../../stores/videoDetail';
import { useToastStore } from '../../stores/toast';
import { cn } from '../../lib/cn';
import type { ChannelInfo, EvergreenFilters, EvergreenVideo } from '@shared/types';

type Readiness = { totalUpdateRuns: number; intervalsAvailable: number; minNeeded: number };

const PAGE_SIZE = 21;

interface EvergreenTabProps {
  channels: ChannelInfo[];
  categoryIds?: string[];
}

export function EvergreenTab({ channels, categoryIds = [] }: EvergreenTabProps) {
  const openDetail = useVideoDetailStore((s) => s.open);
  const showToast = useToastStore((s) => s.show);

  const [items, setItems] = useState<EvergreenVideo[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [filters, setFilters] = useState<EvergreenFilters>({
    minAgeDays: 30,
    minConsecutiveAboveAverage: 3,
    minViewsPerDay: 0,
    videoType: 'all',
    sort: 'viewsPerDay',
  });
  const [titleInput, setTitleInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
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
      const [list, ready] = await Promise.all([
        window.api.channels.analyticsEvergreen({
          ...filters,
          categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        }),
        window.api.channels.analyticsEvergreenReadiness(),
      ]);
      setItems(list);
      setReadiness(ready);
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

  // Drop selections that no longer exist after a refresh.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const v of items) if (prev.has(v.id)) next.add(v.id);
      return next;
    });
  }, [items]);

  // Whenever the filter set changes the result list changes too — reset to
  // page 1 so the user doesn't land on an empty/stale page.
  useEffect(() => {
    setPage(1);
  }, [filters, catKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  // Clamp page if the list shrinks (e.g., user deleted videos in the last page).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pageItems = useMemo(() => items.slice(pageStart, pageEnd), [items, pageStart, pageEnd]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((v) => v.id)));
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Excluir ${ids.length} vídeo${ids.length > 1 ? 's' : ''} do monitoramento?\n\n` +
        `Esses vídeos vão sumir das listas e não serão mais snapshotados.`
    );
    if (!ok) return;
    const removed = await window.api.videos.removeMany(ids);
    setItems((items) => items.filter((it) => !ids.includes(it.id)));
    setSelected(new Set());
    showToast({
      kind: 'success',
      title: `${removed} vídeo${removed > 1 ? 's' : ''} removido${removed > 1 ? 's' : ''}`,
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap items-start gap-3 text-sm">
          <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div className="flex-1 text-xs text-zinc-700 dark:text-zinc-300">
            <p>
              Vídeos antigos (&gt; 30d) que ficaram <b>acima da média do canal em N atualizações
              consecutivas</b>. A cada "Atualizar agora" o sistema mede views/dia desde a última
              checagem e compara com a média do canal naquela mesma janela.
            </p>
          </div>
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
              <option value="30">≥ 30 dias</option>
              <option value="90">≥ 90 dias</option>
              <option value="180">≥ 180 dias</option>
              <option value="365">≥ 1 ano</option>
            </select>
          </FilterField>
          <FilterField label="Atualizações consecutivas">
            <select
              value={filters.minConsecutiveAboveAverage ?? 3}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minConsecutiveAboveAverage: Number(e.target.value),
                }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="2">≥ 2 (mais permissivo)</option>
              <option value="3">≥ 3 (recomendado)</option>
              <option value="4">≥ 4</option>
              <option value="5">≥ 5 (conservador)</option>
            </select>
          </FilterField>
          <FilterField label="Views/dia mínimo">
            <select
              value={filters.minViewsPerDay ?? 0}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minViewsPerDay: Number(e.target.value) }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="0">Sem mínimo</option>
              <option value="1">≥ 1/dia</option>
              <option value="10">≥ 10/dia</option>
              <option value="100">≥ 100/dia</option>
            </select>
          </FilterField>
          <FilterField label="Tipo">
            <select
              value={filters.videoType ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  videoType: e.target.value as 'all' | 'shorts' | 'long' | 'unknown',
                }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">Todos</option>
              <option value="shorts">Shorts (≤ 3min)</option>
              <option value="long">Vídeos longos (&gt; 3min)</option>
              <option value="unknown">Sem duração detectada</option>
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
              <option value="viewsPerDay">Streak + % recente</option>
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

      {readiness &&
        readiness.totalUpdateRuns < (filters.minConsecutiveAboveAverage ?? 3) && (
          <Card className="border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <p className="font-semibold">Coletando dados</p>
                <p className="mt-0.5">
                  Você fez {readiness.totalUpdateRuns} "Atualizar agora" até agora.
                  Pra detectar evergreens com {filters.minConsecutiveAboveAverage ?? 3}{' '}
                  intervalos consecutivos acima da média, faltam{' '}
                  {Math.max(
                    0,
                    (filters.minConsecutiveAboveAverage ?? 3) - readiness.totalUpdateRuns
                  )}{' '}
                  atualização(ões). Espace as atualizações por alguns dias pra ter sinal real.
                </p>
              </div>
            </div>
          </Card>
        )}

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
            {readiness && readiness.totalUpdateRuns < (filters.minConsecutiveAboveAverage ?? 3)
              ? 'Faltam atualizações pra termos sinal estatístico. Veja o aviso acima.'
              : 'Nenhum vídeo > 30d ficou acima da média do canal nas últimas atualizações consecutivas. Tenta reduzir o filtro de "Atualizações consecutivas" ou aguarde mais updates.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox
                checked={items.length > 0 && selected.size === items.length}
                indeterminate={selected.size > 0 && selected.size < items.length}
                onChange={toggleAll}
                ariaLabel="Selecionar todos os evergreens"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {selected.size > 0
                  ? `${selected.size} de ${items.length} selecionado${selected.size > 1 ? 's' : ''}`
                  : totalPages > 1
                    ? `${items.length} vídeo${items.length > 1 ? 's' : ''} · página ${page} de ${totalPages} · selecionar todos`
                    : `${items.length} vídeo${items.length > 1 ? 's' : ''} · selecionar todos`}
              </span>
            </label>
            {selected.size > 0 && (
              <Button onClick={handleBulkDelete} variant="primary" size="sm">
                <Trash2 className="h-4 w-4" />
                Excluir {selected.size}
              </Button>
            )}
          </div>
          <div className="space-y-2">
          {pageItems.map((v, idx) => {
            const isConfirming = confirmingDelete === v.id;
            const isSel = selected.has(v.id);
            async function handleDelete(e: React.MouseEvent) {
              e.stopPropagation();
              if (!isConfirming) {
                setConfirmingDelete(v.id);
                setTimeout(() => {
                  setConfirmingDelete((curr) => (curr === v.id ? null : curr));
                }, 4000);
                return;
              }
              setConfirmingDelete(null);
              await window.api.videos.remove(v.id);
              setItems((items) => items.filter((it) => it.id !== v.id));
              showToast({ kind: 'info', title: 'Vídeo removido do monitoramento' });
            }
            return (
              <div
                key={v.id}
                className={cn(
                  'group flex w-full gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700',
                  isSel && 'ring-2 ring-red-500/40'
                )}
              >
                <div className="pt-1">
                  <Checkbox
                    checked={isSel}
                    onChange={() => toggleSelect(v.id)}
                    ariaLabel={`Selecionar ${v.title}`}
                  />
                </div>
                <button
                  onClick={() => openDetail(v.id)}
                  className="flex flex-1 gap-3 text-left"
                >
                  <div className="flex w-8 shrink-0 items-center justify-center text-sm font-mono font-semibold text-zinc-400">
                    {pageStart + idx + 1}
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
                </button>
                <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      title={`${v.consecutiveAboveAverage} atualizações consecutivas acima da média do canal`}
                    >
                      <TrendingUp className="h-3 w-3" />
                      {v.consecutiveAboveAverage}× acima
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {formatCompact(v.viewsPerDay)}/dia recente
                    </span>
                    {v.recentPercentages.length > 0 && (
                      <div
                        className="flex items-end gap-0.5"
                        title={`Histórico %: ${v.recentPercentages.join(', ')}`}
                      >
                        {v.recentPercentages.map((pct, i) => {
                          // Bar height proportional to % up to ~300%; min 4px so 0% is visible.
                          const heightPx = Math.max(4, Math.min(24, (pct / 200) * 24));
                          const isAbove = pct > 100;
                          return (
                            <span
                              key={i}
                              className={cn(
                                'w-1.5 rounded-sm',
                                isAbove
                                  ? 'bg-emerald-500'
                                  : 'bg-zinc-300 dark:bg-zinc-700'
                              )}
                              style={{ height: `${heightPx}px` }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleDelete}
                    title={isConfirming ? 'Confirma — clique de novo' : 'Excluir do monitoramento'}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-[11px] transition-colors',
                      isConfirming
                        ? 'bg-red-600 text-white'
                        : 'text-zinc-400 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/50'
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isConfirming && 'confirmar?'}
                  </button>
                </div>
              </div>
            );
          })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                Mostrando {pageStart + 1}–{Math.min(pageEnd, items.length)} de {items.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="px-2 text-xs text-zinc-600 dark:text-zinc-400">
                  {page} / {totalPages}
                </span>
                <Button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  variant="secondary"
                  size="sm"
                  disabled={page === totalPages}
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
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
