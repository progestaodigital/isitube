import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, CalendarClock, History, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MissingKeyCTA } from '../components/ui/MissingKeyCTA';
import { CategoryFilter } from '../components/categories/CategoryFilter';
import { cn } from '../lib/cn';
import { useToastStore } from '../stores/toast';
import { useCategories } from '../hooks/useCategories';
import { isCredentialReady, useCredentialStatus } from '../hooks/useCredentialStatus';
import { ChannelList } from './channels/ChannelList';
import { FlaggedVideosList } from './channels/FlaggedVideosList';
import { AddChannelDialog } from './channels/AddChannelDialog';
import { EditChannelCategoriesDialog } from './channels/EditChannelCategoriesDialog';
import { TrashDialog } from './channels/TrashDialog';
import { SchedulePicker } from './channels/SchedulePicker';
import { AnalyticsTab } from './channels/AnalyticsTab';
import { EvergreenTab } from './channels/EvergreenTab';
import type {
  ChannelInfo,
  FlaggedVideosFilters,
  ScheduleInfo,
  UpdateRunInfo,
  VideoInfo,
} from '@shared/types';

type Tab = 'flagged' | 'channels' | 'analytics' | 'evergreen';

export function ChannelsPage() {
  const showToast = useToastStore((s) => s.show);
  const youtubeCred = useCredentialStatus('youtube');
  const youtubeReady = isCredentialReady(youtubeCred);
  const { categories, refresh: refreshCategoriesList } = useCategories();

  const [tab, setTab] = useState<Tab>('flagged');
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [flagged, setFlagged] = useState<VideoInfo[]>([]);
  const [filters, setFilters] = useState<FlaggedVideosFilters>({
    minPercent: 150,
    sinceDays: 30,
  });
  const [categoryFilterIds, setCategoryFilterIds] = useState<string[]>([]);
  const [latestRun, setLatestRun] = useState<UpdateRunInfo | null>(null);
  const [schedule, setSchedule] = useState<ScheduleInfo | null>(null);
  const [updating, setUpdating] = useState(false);
  const [backfillingAll, setBackfillingAll] = useState(false);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelInfo | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);

  const refreshChannels = useCallback(async () => {
    setChannels(await window.api.channels.list());
  }, []);

  const refreshFlagged = useCallback(async () => {
    setFlagged(
      await window.api.channels.getFlaggedVideos({
        ...filters,
        categoryIds: categoryFilterIds.length > 0 ? categoryFilterIds : undefined,
      })
    );
  }, [filters, categoryFilterIds]);

  const refreshLastRun = useCallback(async () => {
    const runs = await window.api.channels.listUpdateRuns(1);
    setLatestRun(runs[0] ?? null);
  }, []);

  const refreshSchedule = useCallback(async () => {
    setSchedule(await window.api.schedule.get());
  }, []);

  useEffect(() => {
    refreshChannels();
    refreshLastRun();
    refreshSchedule();
  }, [refreshChannels, refreshLastRun, refreshSchedule]);

  useEffect(() => {
    refreshFlagged();
  }, [refreshFlagged]);

  // Listen for background update completions (scheduled runs).
  useEffect(() => {
    const off = window.api.events.onUpdateRunCompleted(() => {
      refreshChannels();
      refreshFlagged();
      refreshLastRun();
      refreshSchedule();
    });
    return off;
  }, [refreshChannels, refreshFlagged, refreshLastRun, refreshSchedule]);

  async function handleUpdateAll() {
    if (updating) return;
    setUpdating(true);
    try {
      const run = await window.api.channels.updateAll('manual');
      showToast({
        kind: run.status === 'failed' ? 'error' : 'success',
        title:
          run.status === 'failed' ? 'Atualização falhou' : 'Atualização concluída',
        description:
          run.status === 'failed' && run.errorMessage
            ? run.errorMessage
            : `${run.videosNew} novos vídeos · ${run.videosFlagged} sinalizados.`,
      });
      await Promise.all([refreshChannels(), refreshFlagged(), refreshLastRun()]);
    } finally {
      setUpdating(false);
    }
  }

  async function handleRemoveChannel(id: string) {
    setRemoving((r) => new Set(r).add(id));
    try {
      await window.api.channels.remove(id);
      await Promise.all([refreshChannels(), refreshFlagged()]);
      showToast({ kind: 'info', title: 'Canal removido' });
    } finally {
      setRemoving((r) => {
        const next = new Set(r);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleBulkRemoveChannels(ids: string[]) {
    try {
      const n = await window.api.channels.removeMany(ids);
      await Promise.all([refreshChannels(), refreshFlagged()]);
      showToast({
        kind: 'success',
        title: `${n} canal${n > 1 ? 'is' : ''} removido${n > 1 ? 's' : ''}`,
      });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao remover',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleCancelSchedule() {
    await window.api.schedule.cancel();
    await refreshSchedule();
    showToast({ kind: 'info', title: 'Agendamento cancelado' });
  }

  async function handleDeleteVideo(videoId: string) {
    await window.api.videos.remove(videoId);
    setFlagged((vs) => vs.filter((v) => v.id !== videoId));
    showToast({ kind: 'info', title: 'Vídeo removido do monitoramento' });
  }

  async function handleBulkDeleteVideos(videoIds: string[]) {
    const removed = await window.api.videos.removeMany(videoIds);
    setFlagged((vs) => vs.filter((v) => !videoIds.includes(v.id)));
    showToast({
      kind: 'success',
      title: `${removed} vídeo${removed > 1 ? 's' : ''} removido${removed > 1 ? 's' : ''} do monitoramento`,
    });
  }

  async function handleBackfillChannel(channelId: string) {
    showToast({
      kind: 'info',
      title: 'Sincronizando histórico…',
      description: 'Pode demorar alguns segundos por canal.',
    });
    const result = await window.api.channels.backfill(channelId);
    if (result.success) {
      showToast({ kind: 'success', title: 'Histórico sincronizado', description: result.message });
      await Promise.all([refreshChannels(), refreshFlagged()]);
    } else {
      showToast({ kind: 'error', title: 'Falha', description: result.message });
    }
  }

  async function handleBackfillAll() {
    if (backfillingAll) return;
    const ok = window.confirm(
      `Sincronizar histórico completo de ${channels.length} canal${channels.length > 1 ? 'is' : ''}?\n\n` +
        `Vai puxar TODOS os vídeos da playlist de uploads de cada canal. ` +
        `Pode demorar alguns minutos dependendo do tamanho dos catálogos. ` +
        `Quota usada: ~1 unidade por 50 vídeos por canal.`
    );
    if (!ok) return;
    setBackfillingAll(true);
    showToast({
      kind: 'info',
      title: 'Sincronizando histórico de todos os canais…',
      description: 'Aguarde — pode demorar.',
    });
    try {
      const result = await window.api.channels.backfillAll();
      if (result.success) {
        showToast({
          kind: 'success',
          title: 'Backfill global concluído',
          description: result.message,
        });
      } else {
        showToast({
          kind: 'error',
          title: 'Backfill global parcial ou falhou',
          description: result.message,
        });
      }
      await Promise.all([refreshChannels(), refreshFlagged()]);
    } finally {
      setBackfillingAll(false);
    }
  }

  // Apply the global category filter to the channel list shown in the
  // "Canais cadastrados" tab. Done client-side because we already have all
  // channels loaded — avoids a roundtrip when toggling.
  const filteredChannels =
    categoryFilterIds.length === 0
      ? channels
      : channels.filter((c) =>
          c.categories.some((cat) => categoryFilterIds.includes(cat.id))
        );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Canais</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Monitore canais do YouTube e detecte vídeos com performance fora da curva.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} variant="primary" disabled={!youtubeReady}>
          <Plus className="h-4 w-4" />
          Cadastrar canal
        </Button>
      </header>

      {!youtubeReady && (
        <MissingKeyCTA
          provider="youtube"
          status={youtubeCred}
          feature="Monitoramento de canais"
        />
      )}

      <Card className="flex flex-wrap items-center gap-4 p-4">
        <Button
          onClick={handleUpdateAll}
          disabled={updating || channels.length === 0 || !youtubeReady}
        >
          <RefreshCw className={cn('h-4 w-4', updating && 'animate-spin')} />
          {updating ? 'Atualizando...' : 'Atualizar agora'}
        </Button>

        <Button
          onClick={handleBackfillAll}
          disabled={backfillingAll || channels.length === 0 || !youtubeReady}
          variant="secondary"
          size="sm"
          title="Sincronizar histórico completo de todos os canais (puxa todos os vídeos da playlist de uploads). Útil pra canais cadastrados antes do full-sync."
        >
          <History className={cn('h-4 w-4', backfillingAll && 'animate-spin')} />
          {backfillingAll ? 'Sincronizando…' : 'Sincronizar tudo'}
        </Button>

        <Button
          onClick={() => setTrashOpen(true)}
          variant="ghost"
          size="sm"
          title="Ver vídeos excluídos do monitoramento. Pode restaurar ou apagar permanentemente."
        >
          <Trash2 className="h-4 w-4" />
          Lixeira
        </Button>

        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          {latestRun ? (
            <span>
              Última: {latestRun.status === 'success' ? '✓' : latestRun.status === 'partial' ? '◐' : '✗'}{' '}
              {latestRun.completedAt
                ? new Date(latestRun.completedAt).toLocaleString('pt-BR')
                : '—'}{' '}
              · {latestRun.videosNew} novos, {latestRun.videosFlagged} sinalizados
            </span>
          ) : (
            <span>Sem atualizações ainda.</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <CalendarClock className="h-4 w-4" />
          {schedule ? (
            <>
              <span>
                Próxima:{' '}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {new Date(schedule.scheduledAt).toLocaleString('pt-BR')}
                </span>
              </span>
              <Button onClick={handleCancelSchedule} variant="ghost" size="sm">
                Cancelar
              </Button>
            </>
          ) : (
            <Button onClick={() => setPickerOpen(true)} variant="ghost" size="sm">
              Agendar
            </Button>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-1 overflow-x-auto">
          <TabButton active={tab === 'flagged'} onClick={() => setTab('flagged')}>
            Vídeos em destaque
          </TabButton>
          <TabButton active={tab === 'channels'} onClick={() => setTab('channels')}>
            Canais cadastrados ({filteredChannels.length})
          </TabButton>
          <TabButton active={tab === 'analytics'} onClick={() => setTab('analytics')}>
            Comparativo
          </TabButton>
          <TabButton active={tab === 'evergreen'} onClick={() => setTab('evergreen')}>
            Evergreen
          </TabButton>
        </div>
        <div className="pb-1">
          <CategoryFilter
            categories={categories}
            selectedIds={categoryFilterIds}
            onChange={setCategoryFilterIds}
          />
        </div>
      </div>

      {tab === 'flagged' && (
        <FlaggedVideosList
          videos={flagged}
          channels={channels}
          filters={filters}
          onFilterChange={setFilters}
          onDeleteVideo={handleDeleteVideo}
          onBulkDelete={handleBulkDeleteVideos}
        />
      )}
      {tab === 'channels' && (
        <ChannelList
          channels={filteredChannels}
          onRemove={handleRemoveChannel}
          onBulkRemove={handleBulkRemoveChannels}
          onEditCategories={setEditingChannel}
          onBackfill={handleBackfillChannel}
          removing={removing}
        />
      )}
      {tab === 'analytics' && <AnalyticsTab categoryIds={categoryFilterIds} />}
      {tab === 'evergreen' && (
        <EvergreenTab channels={channels} categoryIds={categoryFilterIds} />
      )}

      <AddChannelDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => {
          refreshChannels();
          refreshCategoriesList();
          showToast({
            kind: 'success',
            title: 'Canal cadastrado',
            description: 'Clica em "Atualizar agora" pra coletar os primeiros vídeos.',
          });
        }}
      />

      <EditChannelCategoriesDialog
        channel={editingChannel}
        onClose={() => setEditingChannel(null)}
        onSaved={() => {
          refreshChannels();
          refreshCategoriesList();
          showToast({ kind: 'success', title: 'Categorias atualizadas' });
        }}
      />

      <SchedulePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onScheduled={() => {
          refreshSchedule();
          showToast({ kind: 'success', title: 'Agendamento criado' });
        }}
      />

      <TrashDialog
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        onChange={() => {
          refreshFlagged();
          refreshChannels();
        }}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-red-600 text-zinc-900 dark:text-zinc-50'
          : 'border-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
      )}
    >
      {children}
    </button>
  );
}
