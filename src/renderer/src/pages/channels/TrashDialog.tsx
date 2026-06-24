import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Eye, Calendar, Clock } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { useToastStore } from '../../stores/toast';
import type { VideoDetail } from '@shared/types';

interface TrashDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a restore/purge so the parent can refresh other lists. */
  onChange: () => void;
}

export function TrashDialog({ open, onClose, onChange }: TrashDialogProps) {
  const showToast = useToastStore((s) => s.show);
  const [items, setItems] = useState<VideoDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [retentionDays, setRetentionDays] = useState(30);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, days] = await Promise.all([
        window.api.videos.listDeleted(),
        window.api.videos.trashRetentionDays(),
      ]);
      setItems(list);
      setRetentionDays(days);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const v of list) if (prev.has(v.id)) next.add(v.id);
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  function toggle(id: string) {
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

  async function handleRestore() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const n = await window.api.videos.restore(ids);
      showToast({
        kind: 'success',
        title: `${n} vídeo${n > 1 ? 's' : ''} restaurado${n > 1 ? 's' : ''}`,
      });
      setSelected(new Set());
      await refresh();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function handlePurge() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Apagar PERMANENTEMENTE ${ids.length} vídeo${ids.length > 1 ? 's' : ''}?\n\n` +
        `Vai remover do banco junto com todos os snapshots históricos. ` +
        `Não tem volta — nem mesmo via restauração de backup do GitHub.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const n = await window.api.videos.purge(ids);
      showToast({
        kind: 'info',
        title: `${n} vídeo${n > 1 ? 's' : ''} apagado${n > 1 ? 's' : ''} permanentemente`,
      });
      setSelected(new Set());
      await refresh();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function handlePurgeAll() {
    if (items.length === 0) return;
    const ok = window.confirm(
      `Limpar a lixeira inteira (${items.length} vídeo${items.length > 1 ? 's' : ''})?\n\n` +
        `Vai remover TODOS os vídeos da lixeira do banco, junto com snapshots. ` +
        `Não tem volta.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const n = await window.api.videos.purgeAll();
      showToast({
        kind: 'info',
        title: `Lixeira limpa — ${n} vídeo${n > 1 ? 's' : ''} apagado${n > 1 ? 's' : ''}`,
      });
      setSelected(new Set());
      await refresh();
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <Modal open={open} onClose={onClose} title="Lixeira de vídeos" size="lg">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800/50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-zinc-700 dark:text-zinc-300">
            Vídeos excluídos via "Excluir do monitoramento" ficam aqui por{' '}
            <b>{retentionDays} dias</b> e depois somem automaticamente. Não
            são mais snapshotados nem aparecem nas listas. <b>Restaurar</b>{' '}
            traz de volta. <b>Apagar permanentemente</b> ou <b>Limpar tudo</b>{' '}
            remove agora do banco junto com snapshots — sem volta.
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-zinc-500">Carregando...</p>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <Trash2 className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700" />
            <p className="mt-3 text-sm font-medium">Lixeira vazia</p>
            <p className="mt-1 text-xs text-zinc-500">
              Nenhum vídeo excluído.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
              <label className="flex cursor-pointer items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  ariaLabel="Selecionar todos"
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  {selected.size > 0
                    ? `${selected.size} de ${items.length} selecionado${selected.size > 1 ? 's' : ''}`
                    : `${items.length} vídeo${items.length > 1 ? 's' : ''} excluído${items.length > 1 ? 's' : ''}`}
                </span>
              </label>
              <div className="flex gap-2">
                {selected.size > 0 ? (
                  <>
                    <Button onClick={handleRestore} disabled={busy} variant="secondary" size="sm">
                      <RotateCcw className="h-4 w-4" />
                      Restaurar {selected.size}
                    </Button>
                    <Button
                      onClick={handlePurge}
                      disabled={busy}
                      variant="primary"
                      size="sm"
                      className="bg-red-700 hover:bg-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                      Apagar definitivamente
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handlePurgeAll}
                    disabled={busy}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                    Limpar tudo
                  </Button>
                )}
              </div>
            </div>

            <div className="max-h-[480px] space-y-2 overflow-y-auto">
              {items.map((v) => {
                const isSel = selected.has(v.id);
                return (
                  <div
                    key={v.id}
                    className={`flex items-start gap-3 rounded-lg border border-zinc-200 p-2 transition-colors dark:border-zinc-800 ${
                      isSel ? 'ring-2 ring-blue-500/40' : ''
                    }`}
                  >
                    <div className="pt-1">
                      <Checkbox
                        checked={isSel}
                        onChange={() => toggle(v.id)}
                        ariaLabel={`Selecionar ${v.title}`}
                      />
                    </div>
                    {v.thumbnailUrl && (
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="h-12 w-20 shrink-0 rounded object-cover opacity-60"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.title}</p>
                      <p className="text-[11px] text-zinc-500">
                        {v.channelTitle ?? 'canal removido'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {formatCompact(v.viewCount)} views
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          publicado {new Date(v.publishedAt).toLocaleDateString('pt-BR')}
                        </span>
                        {v.deletedAt && (
                          <ExpiresIn deletedAtIso={v.deletedAt} retentionDays={retentionDays} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={onClose} variant="ghost" size="sm">
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ExpiresIn({
  deletedAtIso,
  retentionDays,
}: {
  deletedAtIso: string;
  retentionDays: number;
}) {
  const elapsedMs = Date.now() - new Date(deletedAtIso).getTime();
  const elapsedDays = elapsedMs / 86_400_000;
  const daysLeft = Math.max(0, Math.ceil(retentionDays - elapsedDays));
  const isUrgent = daysLeft <= 3;
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        isUrgent ? 'text-amber-600 dark:text-amber-400' : ''
      }`}
      title={`Excluído em ${new Date(deletedAtIso).toLocaleDateString('pt-BR')} — purgado automaticamente em ${retentionDays} dias`}
    >
      <Clock className="h-3 w-3" />
      {daysLeft === 0
        ? 'expira hoje'
        : daysLeft === 1
          ? 'expira amanhã'
          : `expira em ${daysLeft} dias`}
    </span>
  );
}
