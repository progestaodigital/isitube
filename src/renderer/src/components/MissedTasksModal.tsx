// Modal mostrado no boot quando há tasks scheduled cujo "expected" passou
// e last_run_at é mais antigo (ou nunca rodou). Lista cada task com a
// opção "Rodar agora" (executa) ou "Adiar pro próximo agendamento"
// (move last_run_at pra agora; próximo expected fica futuro).
//
// Some quando a lista zera (todas resolvidas).

import { useEffect, useState } from 'react';
import { CalendarClock, Github, Download, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToastStore } from '../stores/toast';
import { useLicense } from '../hooks/useLicense';
import type { MissedTask, ScheduleTaskKind } from '@shared/types';

const TASK_LABEL: Record<ScheduleTaskKind, { label: string; icon: typeof Github }> = {
  backup: { label: 'Backup', icon: Github },
  updateCheck: { label: 'Checagem de atualização', icon: Download },
};

export function MissedTasksModal() {
  const showToast = useToastStore((s) => s.show);
  const { info } = useLicense();
  const [tasks, setTasks] = useState<MissedTask[] | null>(null);
  const [busy, setBusy] = useState<ScheduleTaskKind | null>(null);

  // Carrega no boot, mas só DEPOIS da licença estar válida — não queremos
  // empilhar modal em cima do LicenseGateModal.
  useEffect(() => {
    if (!info?.valid) return;
    let cancelled = false;
    window.api.schedules.listMissed().then((list) => {
      if (cancelled) return;
      setTasks(list);
    });
    return () => {
      cancelled = true;
    };
  }, [info?.valid]);

  if (!tasks || tasks.length === 0) return null;

  async function handleRun(kind: ScheduleTaskKind) {
    setBusy(kind);
    try {
      const result = await window.api.schedules.run(kind);
      showToast({
        kind: result.success ? 'success' : 'error',
        title: result.success ? `${TASK_LABEL[kind].label}: ok` : `${TASK_LABEL[kind].label}: falhou`,
        description: result.message,
      });
      // Remove da lista local quando completar (sucesso ou falha — usuário viu o toast)
      setTasks((prev) => (prev ?? []).filter((t) => t.kind !== kind));
    } finally {
      setBusy(null);
    }
  }

  async function handleSnooze(kind: ScheduleTaskKind) {
    setBusy(kind);
    try {
      await window.api.schedules.snooze(kind);
      setTasks((prev) => (prev ?? []).filter((t) => t.kind !== kind));
    } finally {
      setBusy(null);
    }
  }

  async function handleSnoozeAll() {
    setBusy('backup'); // qualquer valor não-null bloqueia a UI
    try {
      const list = tasks ?? [];
      for (const t of list) {
        // Sequencial pra ordem ser previsível
        // eslint-disable-next-line no-await-in-loop
        await window.api.schedules.snooze(t.kind);
      }
      setTasks([]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={tasks.length > 0}
      onClose={() => {}} // sem fechar clicando fora — força decisão
      closeOnBackdrop={false}
      title="Tarefas agendadas pendentes"
      description="O programa estava fechado quando essas tarefas deveriam ter rodado. Decida o que fazer com cada uma."
      size="md"
    >
      <ul className="mt-3 space-y-2">
        {tasks.map((t) => {
          const meta = TASK_LABEL[t.kind];
          const Icon = meta.icon;
          const expectedLabel = new Date(t.expectedAt).toLocaleString('pt-BR');
          const thisBusy = busy === t.kind;
          return (
            <li
              key={t.kind}
              className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{meta.label}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  Deveria ter rodado em{' '}
                  <span className="text-zinc-700 dark:text-zinc-300">{expectedLabel}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Button
                  onClick={() => handleRun(t.kind)}
                  disabled={thisBusy || busy !== null}
                  variant="primary"
                  size="sm"
                >
                  {thisBusy ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                  )}
                  Rodar agora
                </Button>
                <Button
                  onClick={() => handleSnooze(t.kind)}
                  disabled={thisBusy || busy !== null}
                  variant="ghost"
                  size="sm"
                >
                  Adiar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {tasks.length > 1 && (
        <div className="mt-4 flex justify-end border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <Button onClick={handleSnoozeAll} disabled={busy !== null} variant="ghost" size="sm">
            Adiar todas
          </Button>
        </div>
      )}
    </Modal>
  );
}
