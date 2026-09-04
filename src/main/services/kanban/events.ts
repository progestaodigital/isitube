import { BrowserWindow } from 'electron';

/**
 * Avisa todas as janelas que o board mudou. Chamado por TODA mutação do
 * service — então cobre tanto o que vem da UI quanto o que vem do bridge
 * HTTP local (MCP do Claude Code). É isso que faz a tela do Kanban refletir
 * na hora um card criado/movido/editado por fora.
 *
 * Payload vazio de propósito: o renderer só re-lê o board (query barata,
 * sem bytes de imagem), em vez de tentar aplicar um patch incremental.
 */
export function emitKanbanChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('events:kanban-changed');
  }
}
