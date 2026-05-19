// Scheduler in-process pra tasks "operacionais" recorrentes (backup automático
// pro GitHub e checagem de versão nova do app). Diferente do ScheduledUpdate
// (canais) que é um one-shot agendamento. Aqui o usuário configura
// manual/diário/semanal + horário e o app dispara enquanto estiver aberto.
//
// Storage: tudo via tabela Setting com chaves no formato `${kind}.schedule.X`.
//
// Boot:
//   - listMissedTasks() expõe tasks cujo "last expected" passou e last_run_at
//     é mais antigo. Renderer mostra modal pedindo "Rodar agora ou Adiar".
//
// Tick (1min):
//   - tickScheduler() roda em setInterval. Pra cada task auto, se o "last
//     expected" passou nos últimos 5min e last_run_at é anterior, dispara
//     a operação. Resultado escrito em last_run_at (ou skipped silenciosamente
//     em caso de falha — modal de missed lida no próximo boot).

import { getSetting, setSetting } from '../settings';
import { uploadBackupToGithub } from '../backup/github';
import { checkForUpdates } from '../updates';
import { broadcastToast } from '../channels/scheduler';
import type {
  MissedTask,
  ScheduleConfig,
  ScheduleMode,
  ScheduleRunResult,
  ScheduleTaskKind,
} from '@shared/types';

const TASK_KINDS: ScheduleTaskKind[] = ['backup', 'updateCheck'];

const DEFAULT_TIME = '03:00';
const DEFAULT_WEEKDAY = 0; // domingo
const TICK_INTERVAL_MS = 60_000;
/** Janela em que um "scheduled time" passado dispara fire automático
 *  (boot detection cuida do que ficou muito atrás). */
const TICK_FIRE_WINDOW_MS = 5 * 60_000;

let tickTimer: ReturnType<typeof setInterval> | null = null;

// =============================================================================
// Config storage
// =============================================================================

function keyFor(kind: ScheduleTaskKind, suffix: string): string {
  return `${kind}.schedule.${suffix}`;
}

export async function getScheduleConfig(kind: ScheduleTaskKind): Promise<ScheduleConfig> {
  const [mode, time, weekday, lastRunAt] = await Promise.all([
    getSetting(keyFor(kind, 'mode')),
    getSetting(keyFor(kind, 'time')),
    getSetting(keyFor(kind, 'weekday')),
    getSetting(keyFor(kind, 'last_run_at')),
  ]);

  return {
    kind,
    mode: (mode as ScheduleMode) || 'manual',
    time: time || DEFAULT_TIME,
    weekday: weekday !== null ? parseInt(weekday, 10) || 0 : DEFAULT_WEEKDAY,
    lastRunAt: lastRunAt || null,
  };
}

export async function listScheduleConfigs(): Promise<ScheduleConfig[]> {
  return Promise.all(TASK_KINDS.map(getScheduleConfig));
}

export async function setScheduleConfig(
  kind: ScheduleTaskKind,
  patch: Partial<Omit<ScheduleConfig, 'kind' | 'lastRunAt'>>
): Promise<ScheduleConfig> {
  if (patch.mode !== undefined) await setSetting(keyFor(kind, 'mode'), patch.mode);
  if (patch.time !== undefined) await setSetting(keyFor(kind, 'time'), patch.time);
  if (patch.weekday !== undefined) await setSetting(keyFor(kind, 'weekday'), String(patch.weekday));
  return getScheduleConfig(kind);
}

async function markLastRunAt(kind: ScheduleTaskKind, when: Date = new Date()): Promise<void> {
  await setSetting(keyFor(kind, 'last_run_at'), when.toISOString());
}

// =============================================================================
// Cálculo de horários
// =============================================================================

/**
 * Retorna o instante mais recente NO PASSADO em que essa task deveria ter
 * rodado. Null se mode='manual' (sem horário previsto).
 *
 * Daily: pega HH:MM de hoje; se já passou, devolve hoje, senão ontem.
 * Weekly: pega o weekday alvo na semana atual no HH:MM; se passou, esse
 *   weekday, senão da semana passada.
 */
export function computeLastExpected(config: ScheduleConfig, now: Date = new Date()): Date | null {
  if (config.mode === 'manual') return null;

  const [hh, mm] = config.time.split(':').map((n) => parseInt(n, 10) || 0);
  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setHours(hh ?? 0, mm ?? 0);

  if (config.mode === 'daily') {
    // Se o HH:MM de hoje ainda não passou, o last expected foi ontem.
    if (target > now) {
      target.setDate(target.getDate() - 1);
    }
    return target;
  }

  // weekly: caminha até o weekday alvo nesta semana
  const todayWeekday = now.getDay(); // 0=domingo
  const diff = todayWeekday - config.weekday;
  if (diff > 0) {
    target.setDate(target.getDate() - diff);
  } else if (diff < 0) {
    // weekday alvo só vem mais tarde nesta semana → último expected foi
    // semana passada (mesmo weekday + horário)
    target.setDate(target.getDate() - (7 + diff));
  } else if (target > now) {
    // mesmo dia mas o horário ainda não passou → última foi semana passada
    target.setDate(target.getDate() - 7);
  }
  return target;
}

function isMissed(config: ScheduleConfig, now: Date = new Date()): false | Date {
  const lastExpected = computeLastExpected(config, now);
  if (!lastExpected) return false;
  if (!config.lastRunAt) return lastExpected;
  return new Date(config.lastRunAt) < lastExpected ? lastExpected : false;
}

// =============================================================================
// Boot detection (renderer pergunta "tem algo missed?")
// =============================================================================

export async function listMissedTasks(): Promise<MissedTask[]> {
  const configs = await listScheduleConfigs();
  const now = new Date();
  const out: MissedTask[] = [];
  for (const config of configs) {
    const expected = isMissed(config, now);
    if (expected) {
      out.push({ kind: config.kind, expectedAt: expected.toISOString() });
    }
  }
  return out;
}

// =============================================================================
// Execução das tasks
// =============================================================================

/**
 * Roda uma task. Pra ser chamado pelo tick automático OU pelo botão
 * "Rodar agora" do modal de missed. Atualiza last_run_at em sucesso.
 */
export async function runTask(kind: ScheduleTaskKind): Promise<ScheduleRunResult> {
  try {
    if (kind === 'backup') {
      const res = await uploadBackupToGithub();
      if (res.success) {
        await markLastRunAt(kind);
        return { success: true, message: 'Backup enviado pro GitHub.' };
      }
      return { success: false, message: res.message };
    }

    if (kind === 'updateCheck') {
      const res = await checkForUpdates();
      // Sucesso da CHECAGEM (não da existência de update). Marca last_run_at
      // mesmo quando não há atualização — a task foi cumprida.
      if (!res.error) {
        await markLastRunAt(kind);
        if (res.isNewer && res.latestVersion) {
          broadcastToast({
            kind: 'info',
            title: `Atualização disponível: v${res.latestVersion}`,
            description: 'Clique no badge ao lado do avatar pra ver detalhes e instalar.',
          });
        }
        return {
          success: true,
          message: res.isNewer
            ? `Versão ${res.latestVersion} disponível.`
            : 'Você já está na versão mais recente.',
        };
      }
      return { success: false, message: res.error };
    }

    return { success: false, message: `Task desconhecida: ${kind}` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * "Adiar pro próximo agendamento" — registra last_run_at = agora, pra que o
 * cálculo de last_expected aponte pra próxima ocorrência (não pra agora).
 * Não executa a task.
 */
export async function snoozeTask(kind: ScheduleTaskKind): Promise<void> {
  await markLastRunAt(kind);
}

// =============================================================================
// Tick automático em sessão
// =============================================================================

/**
 * Inicia o scheduler. Tick de 1min. Deve ser chamado uma vez no boot do main
 * (após DB pronto). Idempotente — chamadas subsequentes são no-op.
 */
export function startScheduler(): void {
  if (tickTimer) return;
  // Primeiro tick imediato pra cobrir o caso "boot exatamente após horário
  // alvo de hoje" (ex: usuário abre 08:01 e o agendado era 08:00).
  void tick();
  tickTimer = setInterval(() => void tick(), TICK_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

async function tick(): Promise<void> {
  const now = new Date();
  const configs = await listScheduleConfigs();
  for (const config of configs) {
    if (config.mode === 'manual') continue;
    const lastExpected = computeLastExpected(config, now);
    if (!lastExpected) continue;
    const lastRun = config.lastRunAt ? new Date(config.lastRunAt) : null;
    if (lastRun && lastRun >= lastExpected) continue;
    // Só dispara automaticamente se o expected é recente (dentro de
    // TICK_FIRE_WINDOW_MS). Senão deixa o modal de missed lidar.
    const ageMs = now.getTime() - lastExpected.getTime();
    if (ageMs > TICK_FIRE_WINDOW_MS) continue;
    // Fire-and-forget. Falha não trava o tick.
    void runTask(config.kind).catch((err) => {
      console.error(`[scheduler] tick fire ${config.kind} failed:`, err);
    });
  }
}
