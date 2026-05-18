import { BrowserWindow } from 'electron';
import { getPrisma } from '../../db';
import { runUpdateAll } from '.';
import type { ScheduleInfo, ToastPayload, UpdateRunInfo } from '@shared/types';

let activeTimer: ReturnType<typeof setTimeout> | undefined;

function projectSchedule(row: {
  id: string;
  scheduledAt: Date;
  active: boolean;
  cancelled: boolean;
  ranAt: Date | null;
}): ScheduleInfo {
  return {
    id: row.id,
    scheduledAt: row.scheduledAt.toISOString(),
    active: row.active,
    cancelled: row.cancelled,
    ranAt: row.ranAt?.toISOString() ?? null,
  };
}

export async function getActiveSchedule(): Promise<ScheduleInfo | null> {
  const prisma = getPrisma();
  const row = await prisma.scheduledUpdate.findFirst({
    where: {
      deletedAt: null,
      active: true,
      cancelled: false,
      ranAt: null,
    },
    orderBy: { scheduledAt: 'asc' },
  });
  return row ? projectSchedule(row) : null;
}

export async function setSchedule(scheduledAt: Date): Promise<ScheduleInfo> {
  const prisma = getPrisma();

  // Cancel any existing active schedule (only one at a time).
  await prisma.scheduledUpdate.updateMany({
    where: { deletedAt: null, active: true, cancelled: false, ranAt: null },
    data: { cancelled: true, active: false },
  });

  const created = await prisma.scheduledUpdate.create({
    data: { scheduledAt, active: true },
  });

  scheduleNextTimer();
  return projectSchedule(created);
}

export async function cancelSchedule(): Promise<void> {
  const prisma = getPrisma();
  await prisma.scheduledUpdate.updateMany({
    where: { deletedAt: null, active: true, cancelled: false, ranAt: null },
    data: { cancelled: true, active: false },
  });
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = undefined;
  }
}

/**
 * Schedule a JS setTimeout for the next active future-dated schedule. Past-due
 * schedules are NOT auto-fired here — they surface as a "missed-schedule"
 * startup action so the user can decide whether to update now or reschedule.
 */
export async function scheduleNextTimer(): Promise<void> {
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = undefined;
  }

  const next = await getActiveSchedule();
  if (!next) return;

  const ms = new Date(next.scheduledAt).getTime() - Date.now();
  if (ms <= 0) return; // missed — the renderer will pick this up via getStartupAction

  // Cap at 24 days (setTimeout max safe value is ~24.8 days).
  const safeMs = Math.min(ms, 23 * 24 * 60 * 60 * 1000);
  activeTimer = setTimeout(() => void fireScheduledRun(next.id), safeMs);
}

async function fireScheduledRun(scheduleId: string): Promise<void> {
  const prisma = getPrisma();
  // Re-check that the schedule is still active and not run.
  const row = await prisma.scheduledUpdate.findUnique({ where: { id: scheduleId } });
  if (!row || row.cancelled || row.ranAt || !row.active) return;

  let run: UpdateRunInfo;
  try {
    run = await runUpdateAll('scheduled');
  } catch (err) {
    broadcastToast({
      kind: 'error',
      title: 'Atualização agendada falhou',
      description: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  await prisma.scheduledUpdate.update({
    where: { id: scheduleId },
    data: { ranAt: new Date(), active: false },
  });

  broadcastUpdateRunCompleted(run);
  broadcastToast({
    kind: 'success',
    title: 'Atualização concluída',
    description:
      run.videosNew > 0 || run.videosFlagged > 0
        ? `${run.videosNew} novos vídeos, ${run.videosFlagged} sinalizados.`
        : 'Nenhum vídeo novo dessa vez.',
  });
}

// =============================================================================
// Renderer broadcast helpers
// =============================================================================

export function broadcastUpdateRunCompleted(run: UpdateRunInfo): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('events:update-run-completed', run);
  }
}

/**
 * Sinaliza pra todas as janelas que uma execução de `runUpdateAll` ACABOU DE
 * COMEÇAR. O renderer mantém um Zustand global escutando esses 2 eventos
 * (started + completed) pra exibir indicador de "atualizando" de qualquer
 * página, mesmo quando o usuário navega pra fora da Canais durante o run.
 */
export function broadcastUpdateRunStarted(run: UpdateRunInfo): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('events:update-run-started', run);
  }
}

export function broadcastToast(payload: ToastPayload): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('events:toast', payload);
  }
}
