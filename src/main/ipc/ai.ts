import { ipcMain } from 'electron';
import { getAIService } from '../services/ai';

export function registerAIHandlers(): void {
  ipcMain.handle('ai:generate-keyword-ideas', async (_event, seed: unknown) => {
    if (typeof seed !== 'string' || seed.trim().length === 0) {
      throw new Error('ai:generate-keyword-ideas expects a non-empty string seed');
    }
    const service = await getAIService();
    if (!service) {
      throw new Error(
        'API key da Anthropic não configurada ou inválida. Vá em Configurações → Inteligência Artificial.'
      );
    }
    return service.generateKeywordIdeas(seed.trim());
  });
}
