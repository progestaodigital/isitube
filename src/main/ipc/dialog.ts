import { dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';

export type SaveFileResult = {
  success: boolean;
  message: string;
  path?: string;
};

export function registerDialogHandlers(): void {
  /**
   * Generic file-save IPC. The renderer builds whatever content it wants
   * (CSV, JSON, Markdown, ...) and asks main to open a save dialog and
   * write the file. Avoids each feature having its own IPC.
   */
  ipcMain.handle(
    'dialog:save-file',
    async (
      _event,
      defaultName: unknown,
      extension: unknown,
      content: unknown
    ): Promise<SaveFileResult> => {
      if (typeof defaultName !== 'string') {
        throw new Error('dialog:save-file expects a string defaultName');
      }
      if (typeof extension !== 'string') {
        throw new Error('dialog:save-file expects a string extension');
      }
      if (typeof content !== 'string') {
        throw new Error('dialog:save-file expects a string content');
      }

      const safeExt = extension.replace(/^\.+/, '').toLowerCase();
      const safeName = defaultName.replace(/[\\/:*?"<>|]/g, '_');

      const result = await dialog.showSaveDialog({
        title: 'Salvar arquivo',
        defaultPath: `${safeName}.${safeExt}`,
        filters: [
          { name: safeExt.toUpperCase(), extensions: [safeExt] },
          { name: 'Todos os arquivos', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, message: 'Salvamento cancelado.' };
      }

      await writeFile(result.filePath, content, 'utf-8');
      return { success: true, message: 'Salvo com sucesso.', path: result.filePath };
    }
  );
}
