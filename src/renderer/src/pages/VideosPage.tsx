import { useCallback, useEffect, useState } from 'react';
import { FileText, Flame, Filter as FilterIcon, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { useVideoDetailStore } from '../stores/videoDetail';
import { useToastStore } from '../stores/toast';
import type { ChannelInfo, ExtractedVideosFilters, VideoDetail } from '@shared/types';

export function VideosPage() {
  const openDetail = useVideoDetailStore((s) => s.open);
  const showToast = useToastStore((s) => s.show);

  const [videos, setVideos] = useState<VideoDetail[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [filters, setFilters] = useState<ExtractedVideosFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const list = await window.api.videos.listExtracted(filters);
    setVideos(list);
  }, [filters]);

  useEffect(() => {
    window.api.channels.list().then(setChannels);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Drop selections that no longer match the visible list (after delete or filter change).
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const v of videos) if (prev.has(v.id)) next.add(v.id);
      return next;
    });
  }, [videos]);

  // Re-fetch when the modal closes (might have just extracted new metadata).
  useEffect(() => {
    return useVideoDetailStore.subscribe((state, prev) => {
      if (prev.videoId && !state.videoId) refresh();
    });
  }, [refresh]);

  const allSelected = videos.length > 0 && selected.size === videos.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(videos.map((v) => v.id)));
  }

  async function handleRemoveOne(id: string) {
    setRemoving((r) => new Set(r).add(id));
    try {
      await window.api.videos.remove(id);
      await refresh();
      showToast({ kind: 'info', title: 'Vídeo removido' });
    } finally {
      setRemoving((r) => {
        const next = new Set(r);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleBulkRemove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Apagar ${ids.length} vídeo${ids.length > 1 ? 's' : ''}? A metadata e transcrição extraída também serão removidas.`
    );
    if (!ok) return;
    try {
      const n = await window.api.videos.removeMany(ids);
      await refresh();
      setSelected(new Set());
      showToast({
        kind: 'success',
        title: `${n} vídeo${n > 1 ? 's' : ''} removido${n > 1 ? 's' : ''}`,
      });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao remover',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Vídeos</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Vídeos com informações completas extraídas — descrição, tags, thumbnail HD. Tudo
          armazenado localmente, acessível offline.
        </p>
      </header>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <FilterIcon className="h-4 w-4 text-zinc-500" />
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
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.flaggedOnly ?? false}
              onChange={(e) =>
                setFilters((f) => ({ ...f, flaggedOnly: e.target.checked || undefined }))
              }
              className="h-4 w-4"
            />
            <span className="text-xs">Só outliers</span>
          </label>
        </div>
      </Card>

      {videos.length === 0 ? (
        <Card className="py-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-700" />
          <p className="mt-3 text-sm font-medium">Nenhum vídeo extraído ainda</p>
          <p className="mt-1 text-xs text-zinc-500">
            Vai em <b>Canais</b>, clica em qualquer vídeo da lista de destaques e use{' '}
            <b>"Extrair informações"</b> no modal pra baixar tudo localmente.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
            <label className="flex cursor-pointer items-center gap-3">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
                ariaLabel="Selecionar todos os vídeos"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {selected.size > 0
                  ? `${selected.size} de ${videos.length} selecionado${selected.size > 1 ? 's' : ''}`
                  : `${videos.length} vídeo${videos.length > 1 ? 's' : ''} · selecionar todos`}
              </span>
            </label>
            {selected.size > 0 && (
              <Button onClick={handleBulkRemove} variant="primary" size="sm">
                <Trash2 className="h-4 w-4" />
                Apagar {selected.size}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {videos.map((v) => {
              const isSelected = selected.has(v.id);
              const isRemoving = removing.has(v.id);
              return (
                <div
                  key={v.id}
                  className={`group flex w-full gap-3 rounded-xl border bg-white p-3 transition-colors dark:bg-zinc-900 ${
                    isSelected
                      ? 'border-red-400 ring-2 ring-red-500/30 dark:border-red-700'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center pl-1">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggle(v.id)}
                      ariaLabel={`Selecionar ${v.title}`}
                    />
                  </div>
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
                        {v.flaggedAsOutlier && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <Flame className="h-3 w-3" />
                            {Math.round(v.outlierPercent ?? 0)}%
                          </span>
                        )}
                      </div>
                      {v.channelTitle && (
                        <p className="mt-0.5 text-xs text-zinc-500">{v.channelTitle}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                        <span>
                          Extraído{' '}
                          {v.metadataExtractedAt
                            ? new Date(v.metadataExtractedAt).toLocaleDateString('pt-BR')
                            : '—'}
                        </span>
                        {v.tags && <span>{v.tags.length} tags</span>}
                        {v.category && <span>{v.category}</span>}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemoveOne(v.id)}
                    disabled={isRemoving}
                    title="Remover vídeo"
                    aria-label="Remover vídeo"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
