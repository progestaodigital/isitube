import type { AIProviderName } from '@shared/types';

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type GenerateTextArgs = {
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
};

export type GenerateTextResult = {
  text: string;
  usage?: AIUsage;
};

export type GenerateJSONArgs = GenerateTextArgs;

export type GenerateJSONResult<T> = {
  object: T;
  usage?: AIUsage;
};

export interface AIProvider {
  readonly name: AIProviderName;
  readonly defaultModel: string | null;

  generateText(args: GenerateTextArgs): Promise<GenerateTextResult>;
  generateJSON<T>(args: GenerateJSONArgs): Promise<GenerateJSONResult<T>>;
}
