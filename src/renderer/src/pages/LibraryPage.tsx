import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  Trash2,
  Filter as FilterIcon,
  Search as SearchIcon,
  StickyNote,
  Eye,
  Clock,
  Calendar,
  Flame,
  TrendingUp,
  Save,
  X,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ExportMenu } from '../components/export/ExportMenu';
import { useVideoDetailStore } from '../stores/videoDetail';
import { useToastStore } from '../stores/toast';
import type {
  ChannelInfo,
  LibraryFilters,
  LibraryItem,
  VideoType,
} from '@shared/types';

export function LibraryPage() {
  const openDetail = useVideoDetailStore((s) => s.open);
  const showToast = useToastStore((s) => s.show);

  const [items, setItems] = useState<LibraryItem[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [filters, setFilters] = useState<LibraryFilters>({ sort: 'recent' });
  const [queryInput, setQueryInput] = useState('');
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState('');

  const refresh = useCallback(async () => {
    const list = await window.api.library.list(filters);
    setItems(list);
  }, [filters]);

  useEffect(() => {
    window.api.channels.list().then(setChannels);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch quando o modal de detalhe fecha — o usuário pode ter editado
  // metadata/notes lá dentro, mas a forma mais segura é re-puxar.
  useEffect(() => {
    return useVideoDetailStore.subscribe((state, prev) => {
      if (prev.videoId && !state.videoId) refresh();
    });
  }, [refresh]);

  function applyQuery() {
    setFilters((f) => ({ ...f, query: queryInput.trim() || undefined }));
  }

  async function handleRemove(id: string) {
    const item = items.find((v) => v.id === id);
    if (!item) return;
    const ok = window.confirm(
      `Remover "${item.title}" da biblioteca?\n\nA gente só desmarca o vídeo da biblioteca — ele continua no monitoramento normal do canal.`
    );
    if (!ok) return;
    setRemoving((r) => new Set(r).add(id));
    try {
      const res = await window.api.library.remove(id);
      if (res.success) {
        setItems((vs) => vs.filter((v) => v.id !== id));
        showToast({ kind: 'info', title: 'Removido da biblioteca' });
      } else {
        showToast({ kind: 'error', title: 'Falha', description: res.message });
      }
    } finally {
      setRemoving((r) => {
        const next = new Set(r);
        next.delete(id);
        return next;
      });
    }
  }

  function startEditNotes(item: LibraryItem) {
    setEditingNotesId(item.id);
    setDraftNotes(item.libraryNotes ?? '');
  }

  async function saveNotes(id: string) {
    const res = await window.api.library.updateNotes(id, draftNotes);
    if (res.success) {
      setItems((vs) =>
        vs.map((v) => (v.id === id ? { ...v, libraryNotes: draftNotes || null } : v))
      );
      setEditingNotesId(null);
      showToast({ kind: 'success', title: 'Anotação salva' });
    } else {
      showToast({ kind: 'error', title: 'Falha', description: res.message });
    }
  }

  const stats = useMemo(() => {
    const totalViews = items.reduce((s, v) => s + v.viewCount, 0);
    const withNotes = items.filter((v) => v.libraryNotes && v.libraryNotes.trim()).length;
    return { totalViews, withNotes };
  }, [items]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BookMarked className="h-6 w-6 text-red-600" />
          Biblioteca
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Seus vídeos salvos. Todos os dados — métricas, descrição, transcrição quando
          extraída — ficam disponíveis offline. Adicione anotações pra lembrar por que
          salvou cada um.
        </p>
      </header>

      <Card className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold">
            {items.length} vídeo{items.length !== 1 ? 's' : ''} salvo
            {items.length !== 1 ? 's' : ''}
          </span>
        </div>
        {items.length > 0 && (
          <>
            <span className="text-xs text-zinc-500">
              {formatCompact(stats.totalViews)} views totais
            </span>
            <span className="text-xs text-zinc-500">
              {stats.withNotes} com anotação
            </span>
            {/* Legenda dos dois selos — sem ela, dois badges de porcentagem
                lado a lado parecem a mesma métrica. */}
            <span className="inline-flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3 text-amber-500" />
                em alta no período
              </span>
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                acima da média do canal
              </span>
            </span>
          </>
        )}
        <ExportMenu
          items={items}
          filePrefix="biblioteca"
          origin="biblioteca"
          className="ml-auto"
        />
      </Card>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <FilterIcon className="h-4 w-4 text-zinc-500" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyQuery();
                }}
                onBlur={applyQuery}
                placeholder="Buscar no título..."
                className="h-8 w-56 rounded-md border border-zinc-300 bg-white pl-8 pr-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Canal</span>
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
          </label>

          <label className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Tipo</span>
            <select
              value={filters.videoType ?? 'all'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  videoType: e.target.value as VideoType,
                }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">Todos</option>
              <option value="shorts">Shorts (≤ 3min)</option>
              <option value="long">Vídeos longos (&gt; 3min)</option>
              <option value="unknown">Sem duração detectada</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Ordenar</span>
            <select
              value={filters.sort ?? 'recent'}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sort: e.target.value as LibraryFilters['sort'],
                }))
              }
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="recent">Adicionados recentemente</option>
              <option value="oldest">Mais antigos primeiro</option>
              <option value="mostViews">Mais views</option>
              <option value="title">Título (A-Z)</option>
            </select>
          </label>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="py-16 text-center">
          <BookMarked className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium">Sua biblioteca está vazia</p>
          <p className="mt-1 text-xs text-zinc-500">
            Em <b>Canais</b> ou <b>Vídeos</b>, abra qualquer vídeo e use{' '}
            <b>"Salvar na biblioteca"</b> no modal. Todos os dados ficam aqui pra consulta
            offline.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((v) => {
            const isRemoving = removing.has(v.id);
            const isEditingNotes = editingNotesId === v.id;
            const hasNotes = Boolean(v.libraryNotes && v.libraryNotes.trim());
            return (
              <div
                key={v.id}
                className="group rounded-xl border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div className="flex gap-3">
                  <button
                    onClick={() => openDetail(v.id)}
                    className="flex flex-1 gap-3 text-left"
                  >
                    {(v.thumbnailHdUrl ?? v.thumbnailUrl) && (
                      <img
                        src={v.thumbnailHdUrl ?? v.thumbnailUrl ?? ''}
                        alt=""
                        className="h-16 w-28 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                        <div className="flex shrink-0 items-center gap-1">
                          {/* Em alta no período — tração dos últimos 30 dias.
                              Some quando o vídeo envelhece, e tudo bem: mede agora. */}
                          {v.flaggedAsOutlier && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              title={`Em alta no período — ${Math.round(v.outlierPercent ?? 0)}% do ritmo de views/dia dos outros vídeos ativos do canal nos últimos 30 dias.`}
                            >
                              <Flame className="h-3 w-3" />
                              {Math.round(v.outlierPercent ?? 0)}%
                            </span>
                          )}
                          {/* Em alta sem janela — total de views vs. média
                              histórica do canal. Não expira. */}
                          {v.lifetimeOutlier && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              title={`Acima da média do canal — ${Math.round(v.lifetimeOutlierPercent ?? 0)}% da média histórica${
                                v.channelLifetimeAvgViews
                                  ? ` (${formatCompact(v.channelLifetimeAvgViews)} views/vídeo)`
                                  : ''
                              }. Não expira com o tempo.`}
                            >
                              <TrendingUp className="h-3 w-3" />
                              {Math.round(v.lifetimeOutlierPercent ?? 0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      {v.channelTitle && (
                        <p className="mt-0.5 text-xs text-zinc-500">{v.channelTitle}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {formatCompact(v.viewCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(v.publishedAt).toLocaleDateString('pt-BR')}
                        </span>
                        {v.durationSec !== null && v.durationSec > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(v.durationSec)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <BookMarked className="h-3 w-3" />
                          salvo {formatRelative(v.libraryAddedAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemove(v.id)}
                    disabled={isRemoving}
                    title="Remover da biblioteca"
                    aria-label="Remover da biblioteca"
                    className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={3}
                        placeholder="Por que esse vídeo foi salvo? Ideias derivadas, ângulos, lembretes..."
                        className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => setEditingNotesId(null)}
                          variant="ghost"
                          size="sm"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => saveNotes(v.id)}
                          variant="primary"
                          size="sm"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditNotes(v)}
                      className="flex w-full items-start gap-2 rounded-md p-1.5 text-left text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                    >
                      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                      {hasNotes ? (
                        <span className="whitespace-pre-wrap">{v.libraryNotes}</span>
                      ) : (
                        <span className="italic text-zinc-400">
                          Adicionar anotação...
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'agora há pouco';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days}d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
