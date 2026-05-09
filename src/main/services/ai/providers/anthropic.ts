import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import type {
  AIProvider,
  GenerateJSONArgs,
  GenerateJSONResult,
  GenerateTextArgs,
  GenerateTextResult,
} from './types';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Real Anthropic provider — uses Vercel AI SDK + @ai-sdk/anthropic. The API
 * key never leaves the main process. Selected by the factory in `../index.ts`
 * only when the user's anthropic credential is in `valid` status.
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic' as const;
  readonly defaultModel: string;
  private readonly client: ReturnType<typeof createAnthropic>;

  constructor(apiKey: string, modelId?: string | null) {
    this.client = createAnthropic({ apiKey });
    this.defaultModel = modelId || DEFAULT_MODEL;
  }

  async generateText({
    system,
    prompt,
    model,
    maxTokens,
  }: GenerateTextArgs): Promise<GenerateTextResult> {
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
  }

  private modelFor(modelId?: string) {
    return this.client(modelId || this.defaultModel);
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
