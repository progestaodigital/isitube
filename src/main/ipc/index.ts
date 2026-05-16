import { registerSettingsHandlers } from './settings';
import { registerCredentialsHandlers } from './credentials';
import { registerAIHandlers } from './ai';
import { registerKeywordsHandlers } from './keywords';
import { registerChannelsHandlers } from './channels';
import { registerScheduleHandlers } from './schedule';
import { registerVideosHandlers } from './videos';
import { registerTranscriptsHandlers } from './transcripts';
import { registerLicenseHandlers } from './license';
import { registerDialogHandlers } from './dialog';
import { registerBackupHandlers } from './backup';
import { registerCategoriesHandlers } from './categories';
import { registerUpdatesHandlers } from './updates';
import { registerQuotaHandlers } from './quota';

export function registerIpcHandlers(): void {
  registerSettingsHandlers();
  registerCredentialsHandlers();
  registerAIHandlers();
  registerKeywordsHandlers();
  registerChannelsHandlers();
  registerScheduleHandlers();
  registerVideosHandlers();
  registerTranscriptsHandlers();
  registerLicenseHandlers();
  registerDialogHandlers();
  registerBackupHandlers();
  registerCategoriesHandlers();
  registerUpdatesHandlers();
  registerQuotaHandlers();
}
