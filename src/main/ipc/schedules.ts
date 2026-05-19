import { ipcMain } from 'electron';
import {
  getScheduleConfig,
  listMissedTasks,
  listScheduleConfigs,
  runTask,
  setScheduleConfig,
  snoozeTask,
} from '../services/schedules';
import type { ScheduleMode, ScheduleTaskKind } from '@shared/types';

const VALID_KINDS: ScheduleTaskKind[] = ['backup', 'updateCheck'];
const VALID_MODES: ScheduleMode[] = ['manual', 'daily', 'weekly'];

function assertKind(value: unknown): asserts value is ScheduleTaskKind {
  if (typeof value !== 'string' || !VALID_KINDS.includes(value as ScheduleTaskKind)) {
    throw new Error(`Invalid task kind: ${String(value)}`);
  }
}

export function registerScheduleIpc(): void {
  ipcMain.handle('schedules:list', () => listScheduleConfigs());

  ipcMain.handle('schedules:get', (_event, kind: unknown) => {
    assertKind(kind);
    return getScheduleConfig(kind);
  });

  ipcMain.handle('schedules:set', async (_event, kind: unknown, patch: unknown) => {
    assertKind(kind);
    if (!patch || typeof patch !== 'object') {
      throw new Error('schedules:set expects a patch object');
    }
    const p = patch as Record<string, unknown>;
    const cleaned: Parameters<typeof setScheduleConfig>[1] = {};
    if (typeof p.mode === 'string' && VALID_MODES.includes(p.mode as ScheduleMode)) {
      cleaned.mode = p.mode as ScheduleMode;
    }
    if (typeof p.time === 'string' && /^\d{2}:\d{2}$/.test(p.time)) {
      cleaned.time = p.time;
    }
    if (typeof p.weekday === 'number' && p.weekday >= 0 && p.weekday <= 6) {
      cleaned.weekday = p.weekday;
    }
    return setScheduleConfig(kind, cleaned);
  });

  ipcMain.handle('schedules:list-missed', () => listMissedTasks());

  ipcMain.handle('schedules:run', (_event, kind: unknown) => {
    assertKind(kind);
    return runTask(kind);
  });

  ipcMain.handle('schedules:snooze', async (_event, kind: unknown) => {
    assertKind(kind);
    await snoozeTask(kind);
  });
}
