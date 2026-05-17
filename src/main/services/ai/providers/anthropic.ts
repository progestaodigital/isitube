import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import type {
  AIProvider,
  GenerateJSONArgs,
  GenerateJSONResult,
  GenerateTextArgs,
  GenerateTextResult,
} from './types';
import type { ExternalApiConfig } from '../../external/types';
import { createTrackingFetch } from '../../external/quota';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Real Anthropic provider — uses Vercel AI SDK + @ai-sdk/anthropic. The API
 * key never leaves the main process. Selected by the factory in `../index.ts`
 * once the active license is valid:
 *
 *   - Plano Iniciante → proxy mode (license_key + isipanel proxy baseURL).
 *     The proxy accepts the SDK's default `x-api-key` header (auth swap is
 *     server-side). Quota headers from every response feed `quota.ts`.
 *   - Plano Pro → direct mode (user's own anthropic key + default baseURL).
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  readonly defaultModel: string;
  private readonly client: ReturnType<typeof createAnthropic>;
  private readonly mode: 'direct' | 'proxy';

  constructor(config: ExternalApiConfig, modelId?: string | null) {
    this.mode = config.mode;
    if (config.mode === 'proxy') {
      this.client = createAnthropic({
        apiKey: config.licenseKey,
        baseURL: config.baseUrl,
        fetch: createTrackingFetch('anthropic'),
      });
      console.log(
        `[anthropic] proxy mode constructed: baseURL=${config.baseUrl} defaultModel=${modelId || DEFAULT_MODEL}`
      );
    } else {
      this.client = createAnthropic({ apiKey: config.apiKey });
      console.log(`[anthropic] direct mode constructed: defaultModel=${modelId || DEFAULT_MODEL}`);
    }
    this.defaultModel = modelId || DEFAULT_MODEL;
  }

  async generateText({
    system,
    prompt,
    model,
    maxTokens,
  }: GenerateTextArgs): Promise<GenerateTextResult> {
    const effectiveModel = model || this.defaultModel;
    console.log(`[anthropic] generateText mode=${this.mode} model=${effectiveModel}`);
    try {
      const result = await generateText({
        model: this.modelFor(model) as LanguageModel,
        system,
        prompt,
        maxOutputTokens: maxTokens ?? 1024,
      });
      return {
        text: result.text,
        usage: usageFrom(result.usage),
      };
    } catch (err) {
      logApiError(err);
      throw err;
    }
  }

  async generateJSON<T>({
    system,
    prompt,
    model,
    maxTokens,
  }: GenerateJSONArgs): Promise<GenerateJSONResult<T>> {
    // We use plain generateText + lenient JSON parsing instead of
    // generateObject. Claude often wraps responses in ```json fences or
    // includes a short preamble; the AI SDK's strict object mode rejects
    // these. We coach the model with a strong system instruction and then
    // best-effort extract the JSON object/array from the response.
    const jsonInstruction =
      'IMPORTANTE: Responda APENAS com JSON válido. Sem markdown (não use ```), sem prosa antes ou depois. Apenas o objeto JSON puro, começando com { ou [.';
    const finalSystem = system ? `${system}\n\n${jsonInstruction}` : jsonInstruction;

    const effectiveModel = model || this.defaultModel;
    console.log(`[anthropic] generateJSON mode=${this.mode} model=${effectiveModel}`);

    try {
      const result = await generateText({
        model: this.modelFor(model) as LanguageModel,
        system: finalSystem,
        prompt,
        maxOutputTokens: maxTokens ?? 2048,
      });

      const parsed = parseJsonLeniently<T>(result.text);
      return {
        object: parsed,
        usage: usageFrom(result.usage),
      };
    } catch (err) {
      logApiError(err);
      throw err;
    }
  }

  private modelFor(modelId?: string) {
    return this.client(modelId || this.defaultModel);
  }
}

/**
 * Diagnostic: capture AI SDK error detail (status + body + url) so 403s from
 * the isipanel proxy don't surface as just "Forbidden" with no hint about
 * which proxy rule rejected the call. Temporary while we shake out 9.A.3
 * integration issues; safe to leave in (only fires on errors).
 */
function logApiError(err: unknown): void {
  if (!err || typeof err !== 'object') return;
  const e = err as Record<string, unknown>;
  console.error('[anthropic] API error:', e.name ?? 'unknown', e.message);
  if ('statusCode' in e) console.error('  statusCode:', e.statusCode);
  if ('url' in e) console.error('  url:', e.url);
  if ('responseBody' in e) console.error('  responseBody:', e.responseBody);
  if ('responseHeaders' in e) {
    const h = e.responseHeaders as Record<string, string> | undefined;
    if (h) {
      // Strip noisy/standard headers; keep the X-Quota-* + content-type for context.
      const interesting = ['content-type', 'x-quota-used', 'x-quota-remaining', 'x-quota-period'];
      const summary: Record<string, string> = {};
      for (const k of interesting) {
        if (h[k]) summary[k] = h[k];
      }
      console.error('  responseHeaders:', summary);
    }
  }
}

function usageFrom(usage: unknown): { inputTokens: number; outputTokens: number } | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const u = usage as Record<string, unknown>;
  const input = typeof u.inputTokens === 'number' ? u.inputTokens : 0;
  const output = typeof u.outputTokens === 'number' ? u.outputTokens : 0;
  if (input === 0 && output === 0) return undefined;
  return { inputTokens: input, outputTokens: output };
}

/**
 * Tolerant JSON extractor. Tries, in order:
 *   1. Direct parse of the trimmed text
 *   2. Strip ``` or ```json fences then parse
 *   3. Find the first balanced { ... } or [ ... ] in the text and parse it
 * Throws a descriptive error including the first 200 chars of the response
 * if all attempts fail.
 */
function parseJsonLeniently<T>(text: string): T {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    /* try fence-stripped */
  }

  let stripped = trimmed;
  if (stripped.startsWith('```')) {
    stripped = stripped
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(stripped) as T;
    } catch {
      /* try regex extraction */
    }
  }

  // Greedy match for the outermost object or array.
  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  const candidate = objectMatch?.[0] ?? arrayMatch?.[0];
  if (candidate) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      /* fall through */
    }
  }

  throw new Error(
    `Resposta da IA não veio em JSON válido. Primeiros 200 chars: ${text.slice(0, 200)}...`
  );
}
