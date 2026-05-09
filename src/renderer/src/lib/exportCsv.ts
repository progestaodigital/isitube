import { useToastStore } from '../stores/toast';
import { toCsv, csvFilename, type CsvCell } from './csv';

/**
 * Wraps the dialog IPC + toast feedback in a single call. Used by every
 * "Exportar CSV" button across the app.
 */
export async function exportCsv(
  prefix: string,
  headers: string[],
  rows: CsvCell[][]
): Promise<void> {
  const showToast = useToastStore.getState().show;

  if (rows.length === 0) {
    showToast({
      kind: 'info',
      title: 'Nada pra exportar',
      description: 'A lista filtrada está vazia.',
    });
    return;
  }

  const content = toCsv(headers, rows);
  const result = await window.api.dialog.saveFile(csvFilename(prefix), 'csv', content);

  if (result.success && result.path) {
    showToast({ kind: 'success', title: 'CSV salvo', description: result.path });
  } else if (result.message !== 'Salvamento cancelado.') {
    showToast({ kind: 'error', title: 'Falha ao salvar', description: result.message });
  }
}
