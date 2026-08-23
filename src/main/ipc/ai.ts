import { ipcMain } from 'electron';
import { getAIService } from '../services/ai';

const NO_SERVICE_MSG =
  'API key da Anthropic não configurada ou inválida. Vá em Configurações → Inteligência Artificial.';

export function registerAIHandlers(): void {
  ipcMain.handle('ai:generate-keyword-ideas', async (_event, seed: unknown) => {
    if (typeof seed !== 'string' || seed.trim().length === 0) {
      throw new Error('ai:generate-keyword-ideas expects a non-empty string seed');
    }
    const service = await getAIService();
    if (!service) throw new Error(NO_SERVICE_MSG);
    return service.generateKeywordIdeas(seed.trim());
  });
}
