import { AIService } from './AIService';
import { MockProvider } from './providers/mock';
import { AnthropicProvider } from './providers/anthropic';
import type { AIProvider } from './providers/types';
import { getCredentialPlainText, listCredentialStatuses } from '../credentials';
import { getSetting } from '../settings';
import { getActiveLicenseKey, getActivePlan } from '../license';
import { ANTHROPIC_PROXY_BASE_URL } from '../external/endpoints';

const MODEL_SETTING_KEY = 'ai.model';

// Plano Iniciante is restricted server-side to Haiku 4.5; the proxy rejects
// other models with 403 `model_not_allowed`. We force-pin the client to a
// Haiku variant so the user's configured model preference (which may be
// Sonnet or Opus on the Pro tier) doesn't blow up after a Pro→Iniciante
// downgrade. Matches the regex `^claude-haiku-4-5` the proxy enforces.
const INICIANTE_FORCED_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Selects the active provider per request based on the current license plan:
 *
 *   - Plano Iniciante  → AnthropicProvider in `proxy` mode (license_key auth,
 *                        forced to Haiku 4.5, quota enforced server-side).
 *   - Plano Pro / BYOK → AnthropicProvider in `direct` mode using the user's
 *                        own Anthropic key + their model choice.
 *
 * Returns null when there's no usable provider (no valid license, or pro
 * tier without an anthropic credential cadastrated). The IPC handler turns
 * that into a "configure sua chave / verifique a licença" error in the UI.
 */
async function selectProvider(): Promise<AIProvider | null> {
  const plan = await getActivePlan();
  if (!plan) return null;

  if (plan === 'iniciante') {
    const licenseKey = await getActiveLicenseKey();
    if (!licenseKey) return null;
    return new AnthropicProvider(
      { mode: 'proxy', licenseKey, baseUrl: ANTHROPIC_PROXY_BASE_URL },
      INICIANTE_FORCED_MODEL
    );
  }

  // Pro / BYOK
  const statuses = await listCredentialStatuses();
  const anthropic = statuses.find((s) => s.provider === 'anthropic');
  if (anthropic && anthropic.status === 'valid' && anthropic.hasValue) {
    const apiKey = await getCredentialPlainText('anthropic');
    if (apiKey) {
      const model = (await getSetting(MODEL_SETTING_KEY)) || undefined;
      return new AnthropicProvider({ mode: 'direct', apiKey }, model);
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
