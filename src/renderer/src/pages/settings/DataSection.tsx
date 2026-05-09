import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToastStore } from '../../stores/toast';

export function DataSection() {
  const showToast = useToastStore((s) => s.show);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
