import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { SchedulePicker } from './SchedulePicker';
import type { StartupAction } from '@shared/types';

interface UpdatePopupProps {
  onActionTaken: () => void;
}

/**
 * Popup-on-open: queries main for the current startup action and shows the
 * appropriate modal. Three possible decisions for the user, matching the
 * specced "Sim / Não / Agendar" options:
 *   1. Atualizar agora — fires the update immediately
 *   2. Não — dismisses for ~12h (or simply closes the missed-schedule modal)
 *   3. Agendar — opens the schedule picker
 */
export function UpdatePopup({ onActionTaken }: UpdatePopupProps) {
  const [action, setAction] = useState<StartupAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.channels.getStartupAction().then((a) => {
      if (!cancelled) setAction(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!action || action.kind === 'none') return null;

  const isMissed = action.kind === 'missed-schedule';

  async function handleUpdateNow() {
    setBusy(true);
    try {
      await window.api.channels.updateAll('startup');
      setAction({ kind: 'none' });
      onActionTaken();
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    if (action!.kind === 'suggest-update') {
      await window.api.channels.dismissStartupSuggestion();
    }
    setAction({ kind: 'none' });
  }

  return (
    <>
      <Modal
        open={!pickerOpen}
        onClose={handleDismiss}
        closeOnBackdrop={false}
        title={isMissed ? 'Atualização agendada perdida' : 'Atualizar canais agora?'}
        description={
          isMissed
            ? `Você havia agendado uma atualização para ${formatLocal((action as { schedule: { scheduledAt: string } }).schedule.scheduledAt)}, mas o app não estava aberto. Que tal rodar agora?`
            : action.kind === 'suggest-update' && action.lastRunAt
              ? `Última atualização foi em ${formatLocal(action.lastRunAt)}. Tem ${action.channelsCount} canal${action.channelsCount > 1 ? 'is' : ''} cadastrado${action.channelsCount > 1 ? 's' : ''}.`
              : action.kind === 'suggest-update'
                ? `Você tem ${action.channelsCount} canal${action.channelsCount > 1 ? 'is' : ''} cadastrado${action.channelsCount > 1 ? 's' : ''} mas nunca atualizou.`
                : ''
        }
        size="md"
      >
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button onClick={handleDismiss} variant="ghost" disabled={busy}>
            Não
          </Button>
          <Button
            onClick={() => setPickerOpen(true)}
            variant="secondary"
            disabled={busy}
          >
            {isMissed ? 'Reagendar' : 'Agendar'}
          </Button>
          <Button onClick={handleUpdateNow} variant="primary" disabled={busy}>
            {busy ? 'Atualizando...' : 'Sim, atualizar agora'}
          </Button>
        </div>
      </Modal>

      <SchedulePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onScheduled={() => {
          setAction({ kind: 'none' });
          onActionTaken();
        }}
      />
    </>
  );
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}
