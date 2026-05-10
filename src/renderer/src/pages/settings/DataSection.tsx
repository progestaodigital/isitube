import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, Database, Sparkles } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToastStore } from '../../stores/toast';

type SnapshotsStats = {
  videoSnapshots: number;
  channelSnapshots: number;
  videoCutoff: string;
  channelCutoff: string;
};

export function DataSection() {
  const showToast = useToastStore((s) => s.show);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapStats, setSnapStats] = useState<SnapshotsStats | null>(null);
  const [cleaning, setCleaning] = useState(false);

  async function refreshSnapStats() {
    try {
      setSnapStats(await window.api.channels.snapshotsStats());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshSnapStats();
  }, []);

  async function handleCleanupSnapshots() {
    setCleaning(true);
    try {
      const result = await window.api.channels.snapshotsCleanup();
      showToast({
        kind: 'success',
        title: 'Snapshots antigos removidos',
        description: `${result.videoSnapshots} de vídeo + ${result.channelSnapshots} de canal apagados.`,
      });
      await refreshSnapStats();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha na limpeza',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCleaning(false);
    }
  }

  async function handleConfirmReset() {
    setBusy(true);
    try {
      const result = await window.api.channels.removeAll();
      showToast({
        kind: 'success',
        title: 'Dados removidos',
        description: `${result.channels} canal(is) e ${result.videos} vídeo(s) apagados.`,
      });
      setConfirmOpen(false);
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao remover',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section
        title="Snapshots históricos"
        description="A cada 'Atualizar agora' o sistema guarda um snapshot de views de cada vídeo e canal. Isso alimenta evergreen, comparativo e detector de destaque. Snapshots antigos são apagados automaticamente; aqui dá pra forçar a limpeza."
      >
        <div className="space-y-3">
          {snapStats && (
            <div className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <div className="text-zinc-700 dark:text-zinc-300">
                <p>
                  Pendentes pra limpeza:{' '}
                  <b>{snapStats.videoSnapshots.toLocaleString('pt-BR')}</b> snapshots de vídeo
                  {' '}(&gt; 90 dias) e{' '}
                  <b>{snapStats.channelSnapshots.toLocaleString('pt-BR')}</b> snapshots de canal
                  {' '}(&gt; 365 dias).
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  A limpeza roda automaticamente após cada "Atualizar agora". Use o botão
                  abaixo só se quiser forçar agora.
                </p>
              </div>
            </div>
          )}
          <Button
            onClick={handleCleanupSnapshots}
            disabled={cleaning}
            variant="secondary"
            size="sm"
          >
            <Sparkles className={`h-4 w-4 ${cleaning ? 'animate-pulse' : ''}`} />
            {cleaning ? 'Limpando...' : 'Limpar snapshots antigos'}
          </Button>
        </div>
      </Section>

      <Section
        title="Dados de monitoramento"
        description="Apagar canais cadastrados e vídeos extraídos. Suas chaves de API, agendamentos e configurações ficam intactos."
      >
        <Button
          onClick={() => setConfirmOpen(true)}
          variant="secondary"
          size="sm"
          className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-4 w-4" />
          Apagar canais e vídeos
        </Button>
      </Section>

      <Modal
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        size="sm"
        closeOnBackdrop={!busy}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Apagar todos os dados de canais?</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Vai remover <b>todos os canais cadastrados</b> e <b>todos os vídeos coletados</b>{' '}
              (incluindo metadata e transcrições extraídas). Suas chaves de API,
              configurações e licença ficam intactas.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Soft delete — fica marcado como apagado no banco. Pra restaurar precisaria de
              acesso direto ao SQLite.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            onClick={() => setConfirmOpen(false)}
            variant="ghost"
            size="sm"
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmReset}
            variant="primary"
            size="sm"
            disabled={busy}
          >
            {busy ? 'Apagando...' : 'Sim, apagar tudo'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
