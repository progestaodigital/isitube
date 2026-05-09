import { AIService } from './AIService';
import { MockProvider } from './providers/mock';
import { AnthropicProvider } from './providers/anthropic';
import type { AIProvider } from './providers/types';
import { getCredentialPlainText, listCredentialStatuses } from '../credentials';
import { getSetting } from '../settings';

const MODEL_SETTING_KEY = 'ai.model';

/**
 * Selects the active provider per request. If the user has a valid Anthropic
 * credential we use the real provider with their configured model; otherwise
 * we return null and the IPC handler turns that into a clear "configure your
 * key" error for the renderer.
 *
 * Per Phase 7 product decision (Option A): no automatic mock fallback when
 * the credential is missing/invalid.
 */
async function selectProvider(): Promise<AIProvider | null> {
  const statuses = await listCredentialStatuses();
  const anthropic = statuses.find((s) => s.provider === 'anthropic');

  if (anthropic && anthropic.status === 'valid' && anthropic.hasValue) {
    const apiKey = await getCredentialPlainText('anthropic');
    if (apiKey) {
      const model = (await getSetting(MODEL_SETTING_KEY)) || undefined;
      return new AnthropicProvider(apiKey, model);
    }
  }
  return null;
}

export async function getAIService(): Promise<AIService | null> {
  const provider = await selectProvider();
  if (!provider) return null;
  return new AIService(provider);
}

/**
 * Standalone mock service — used by IPC handlers that explicitly want to
 * fall back to the mock for development/demo purposes. Phase 8 production
 * code should NOT use this; it returns the same fake data the renderer was
 * seeing in Phases 2-7. Kept exported because the AI Demo on the Home page
 * still references it for testing without a real key.
 */
export function getMockAIService(): AIService {
  return new AIService(new MockProvider());
}
