import type { KeywordIdea } from '@shared/types';
import type {
  AIProvider,
  GenerateJSONArgs,
  GenerateJSONResult,
  GenerateTextArgs,
  GenerateTextResult,
} from './types';

function delay(min = 700, max = 1500): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractSeed(prompt: string): string {
  // Pulls the bolded seed token out of the prompt template (`**{{seed}}**`).
  return prompt.match(/\*\*(.+?)\*\*/)?.[1] ?? 'seu nicho';
}

function buildKeywordIdeas(seed: string): KeywordIdea[] {
  return [
    {
      term: `${seed} para iniciantes`,
      rationale:
        'Termos com "para iniciantes" tendem a ter alto volume de busca e concorrência mais baixa, ideais para captar audiência nova.',
      estimatedDifficulty: 'low',
      estimatedVolume: 'high',
    },
    {
      term: `${seed} em 2026`,
      rationale:
        'Adicionar o ano filtra conteúdo desatualizado e atrai cliques de quem busca o que está em alta agora.',
      estimatedDifficulty: 'medium',
      estimatedVolume: 'medium',
    },
    {
      term: `melhores ${seed}`,
      rationale:
        'Comparativos atraem audiência em fase de decisão — bons para CTR e tempo de retenção.',
      estimatedDifficulty: 'medium',
      estimatedVolume: 'high',
    },
    {
      term: `${seed} grátis`,
      rationale:
        'Volume alto. Cuidado: intenção comercial baixa, mas excelente para crescer canal.',
      estimatedDifficulty: 'low',
      estimatedVolume: 'high',
    },
    {
      term: `como começar com ${seed}`,
      rationale:
        'Intenção informacional clara — perfeito para tutoriais e roteiros do tipo passo-a-passo.',
      estimatedDifficulty: 'low',
      estimatedVolume: 'medium',
    },
  ];
}

export class MockProvider implements AIProvider {
  readonly name = 'mock' as const;
  readonly defaultModel = null;

  async generateText({ prompt }: GenerateTextArgs): Promise<GenerateTextResult> {
    await delay();
    return {
      text: `[MOCK] Resposta de teste para o prompt: ${prompt.slice(0, 120)}...`,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  async generateJSON<T>({ prompt }: GenerateJSONArgs): Promise<GenerateJSONResult<T>> {
    await delay();
    const seed = extractSeed(prompt);
    const object = { ideas: buildKeywordIdeas(seed) } as unknown as T;
    return { object, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
