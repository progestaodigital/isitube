import { ipcMain } from 'electron';
import {
  cancelSchedule,
  getActiveSchedule,
  setSchedule,
} from '../services/channels/scheduler';

export function registerScheduleHandlers(): void {
  ipcMain.handle('schedule:get', async () => getActiveSchedule());

  ipcMain.handle('schedule:set', async (_event, isoString: unknown) => {
    if (typeof isoString !== 'string') {
      throw new Error('schedule:set expects an ISO datetime string');
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      throw new Error('schedule:set received an invalid date string');
    }
    return setSchedule(date);
  });

  ipcMain.handle('schedule:cancel', async () => {
    await cancelSchedule();
  });
}
