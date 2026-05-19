// Section em Configurações pra configurar backup automático e checagem de
// atualização recorrentes. O scheduler in-process do main dispara baseado
// nessas configs enquanto o app estiver aberto. Tasks missed (app estava
// fechado no horário) são surfacedas via MissedTasksModal no próximo boot.

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, AlertTriangle, Save, Github, RefreshCw, Loader2 } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../stores/toast';
import { cn } from '../../lib/cn';
import type {
  ScheduleConfig,
  ScheduleMode,
  ScheduleTaskKind,
} from '@shared/types';

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

const TASK_META: Record<
  ScheduleTaskKind,
  { label: string; description: string; icon: typeof Github }
> = {
  backup: {
    label: 'Backup automático',
    description:
      'Upload do banco de dados como Release no seu repositório GitHub. Requer token GitHub configurado.',
    icon: Github,
  },
  channelUpdate: {
    label: 'Atualização dos canais',
    description:
      'Mesmo "Atualizar agora" da página Canais — busca métricas novas, descobre vídeos recentes e recalcula outliers em todos os canais monitorados.',
    icon: RefreshCw,
  },
};

export function SchedulesSection() {
  const showToast = useToastStore((s) => s.show);
  const [configs, setConfigs] = useState<ScheduleConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await window.api.schedules.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function updateConfig(kind: ScheduleTaskKind, next: ScheduleConfig) {
    setConfigs((prev) => prev.map((c) => (c.kind === kind ? next : c)));
  }

  async function handleRunNow(kind: ScheduleTaskKind) {
    const result = await window.api.schedules.run(kind);
    showToast({
      kind: result.success ? 'success' : 'error',
      title: result.success ? 'Tarefa executada' : 'Falha na tarefa',
      description: result.message,
    });
    refresh();
  }

  return (
    <Section
      title="Agendamentos"
      description="Backup e checagem de atualização recorrentes — diários ou semanais."
    >
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Pra esses agendamentos rodarem, o programa precisa estar{' '}
            <b>aberto</b> e o computador <b>conectado à internet</b> no horário
            marcado. Se o app estiver fechado, na próxima abertura aparece um
            pop-up perguntando se você quer rodar a tarefa pendente ou adiar
            pra próxima ocorrência.
          </p>
        </div>
      </div>

      {loading && configs.length === 0 ? (
        <p className="text-sm text-zinc-500">Carregando configurações…</p>
      ) : (
        <div className="space-y-4">
          {configs.map((cfg) => (
            <TaskCard
              key={cfg.kind}
              config={cfg}
              onChange={(next) => updateConfig(cfg.kind, next)}
              onRunNow={() => handleRunNow(cfg.kind)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

// ============================================================================

interface TaskCardProps {
  config: ScheduleConfig;
  onChange: (next: ScheduleConfig) => void;
  onRunNow: () => void;
}

function TaskCard({ config, onChange, onRunNow }: TaskCardProps) {
  const meta = TASK_META[config.kind];
  const Icon = meta.icon;
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Estado local de rascunho — só salva quando o usuário clica "Salvar".
  // Evita request em cada keystroke do time picker.
  const [draft, setDraft] = useState({
    mode: config.mode,
    time: config.time,
    weekday: config.weekday,
  });

  useEffect(() => {
    setDraft({ mode: config.mode, time: config.time, weekday: config.weekday });
  }, [config.mode, config.time, config.weekday]);

  const dirty =
    draft.mode !== config.mode ||
    draft.time !== config.time ||
    draft.weekday !== config.weekday;

  async function handleSave() {
    setSaving(true);
    try {
      const next = await window.api.schedules.set(config.kind, {
        mode: draft.mode,
        time: draft.time,
        weekday: draft.weekday,
      });
      onChange(next);
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      await onRunNow();
    } finally {
      setRunning(false);
    }
  }

  const lastRunLabel = config.lastRunAt
    ? new Date(config.lastRunAt).toLocaleString('pt-BR')
    : '—';

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{meta.label}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{meta.description}</p>
        </div>
        <Button onClick={handleRun} disabled={running} variant="ghost" size="sm">
          {running ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CalendarClock className="mr-1 h-3.5 w-3.5" />
          )}
          Rodar agora
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Frequência
          </label>
          <select
            value={draft.mode}
            onChange={(e) =>
              setDraft((d) => ({ ...d, mode: e.target.value as ScheduleMode }))
            }
            className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="manual">Manual (sem agendamento)</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Horário
          </label>
          <input
            type="time"
            value={draft.time}
            onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
            disabled={draft.mode === 'manual'}
            className={cn(
              'h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900',
              draft.mode === 'manual' && 'cursor-not-allowed opacity-50'
            )}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Dia da semana
          </label>
          <select
            value={draft.weekday}
            onChange={(e) =>
              setDraft((d) => ({ ...d, weekday: parseInt(e.target.value, 10) }))
            }
            disabled={draft.mode !== 'weekly'}
            className={cn(
              'h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900',
              draft.mode !== 'weekly' && 'cursor-not-allowed opacity-50'
            )}
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-[11px] text-zinc-500">
          Última execução: <span className="text-zinc-700 dark:text-zinc-300">{lastRunLabel}</span>
        </p>
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          variant={dirty ? 'primary' : 'secondary'}
          size="sm"
        >
          <Save className="mr-1 h-3.5 w-3.5" />
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
