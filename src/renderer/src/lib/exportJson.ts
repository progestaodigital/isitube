import { useToastStore } from '../stores/toast';
import { csvFilename } from './csv';

/**
 * Wraps the dialog IPC + toast feedback for a JSON export, mirroring
 * `exportCsv`. `csvFilename` is reused only for its date-stamped prefix
 * (`biblioteca-2026-08-11`); the extension is passed separately.
 */
export async function exportJson(prefix: string, data: unknown, count: number): Promise<void> {
  const showToast = useToastStore.getState().show;

  if (count === 0) {
    showToast({
      kind: 'info',
      title: 'Nada pra exportar',
      description: 'A lista filtrada está vazia.',
    });
    return;
  }

  const content = JSON.stringify(data, null, 2);
  const result = await window.api.dialog.saveFile(csvFilename(prefix), 'json', content);

  if (result.success && result.path) {
    showToast({ kind: 'success', title: 'JSON salvo', description: result.path });
  } else if (result.message !== 'Salvamento cancelado.') {
    showToast({ kind: 'error', title: 'Falha ao salvar', description: result.message });
  }
}
