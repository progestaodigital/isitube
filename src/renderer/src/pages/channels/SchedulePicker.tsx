import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

interface SchedulePickerProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

function defaultLocalDateTime(): string {
  // Default to tomorrow at 09:00 local time, formatted for <input type=datetime-local>.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SchedulePicker({ open, onClose, onScheduled }: SchedulePickerProps) {
  const [value, setValue] = useState<string>(defaultLocalDateTime());
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (busy) return;
    const local = new Date(value);
    if (Number.isNaN(local.getTime()) || local <= new Date()) return;
    setBusy(true);
    try {
      await window.api.schedule.set(local.toISOString());
      onScheduled();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agendar atualização"
      description="O computador precisa estar ligado e o app aberto na hora marcada. Apenas um agendamento ativo por vez — o novo substitui o anterior."
      size="sm"
    >
      <div className="space-y-3">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />

        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Se você fechar o app antes da hora marcada, a atualização será sinalizada como
          "perdida" no próximo abertura — você poderá rodar na hora ou reagendar.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} variant="ghost" size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={busy} variant="primary" size="sm">
            {busy ? 'Salvando...' : 'Agendar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
