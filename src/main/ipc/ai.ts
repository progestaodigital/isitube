import { ipcMain } from 'electron';
import { getAIService } from '../services/ai';
import {
  generateCardHooks,
  generateCardScript,
  generateCardSeo,
} from '../services/card-agents';

const NO_SERVICE_MSG =
  'API key da Anthropic não configurada ou inválida. Vá em Configurações → Inteligência Artificial.';

function assertCardId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('esperava um id de card');
  }
}

export function registerAIHandlers(): void {
  ipcMain.handle('ai:generate-keyword-ideas', async (_event, seed: unknown) => {
    if (typeof seed !== 'string' || seed.trim().length === 0) {
      throw new Error('ai:generate-keyword-ideas expects a non-empty string seed');
    }
    const service = await getAIService();
    if (!service) throw new Error(NO_SERVICE_MSG);
    return service.generateKeywordIdeas(seed.trim());
  });

  ipcMain.handle('ai:card-seo', async (_event, cardId: unknown) => {
    assertCardId(cardId);
    return generateCardSeo(cardId);
  });

  ipcMain.handle('ai:card-hooks', async (_event, cardId: unknown) => {
    assertCardId(cardId);
    return generateCardHooks(cardId);
  });

  ipcMain.handle('ai:card-script', async (_event, cardId: unknown, targetLengthMin: unknown) => {
    assertCardId(cardId);
    const length = typeof targetLengthMin === 'number' ? targetLengthMin : 8;
    return generateCardScript(cardId, length);
  });
}
