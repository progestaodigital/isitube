import type {
  ChannelAudit,
  ChannelAuditInput,
  ChannelAuditResult,
  KeywordIdea,
  KeywordIdeasResult,
} from '@shared/types';
import type { AIProvider } from './providers/types';
import { loadPrompt } from './prompts';

/**
 * Domain-level AI service. Higher-level methods (generateKeywordIdeas,
 * analyzeOpportunity, suggestTitles, summarizeTranscript, ...) live here
 * so the renderer never talks directly to a provider — only to AIService
 * via IPC. New domain methods should be added here, not at the IPC boundary.
 */
export class AIService {
  constructor(private readonly provider: AIProvider) {}

  async generateKeywordIdeas(seed: string): Promise<KeywordIdeasResult> {
    const prompt = await loadPrompt('keyword-ideas', { seed });
    const startedAt = Date.now();

    const { object } = await this.provider.generateJSON<{ ideas: KeywordIdea[] }>({
      system:
        'Você é um especialista em SEO para YouTube. Responda APENAS com JSON válido, sem texto adicional.',
      prompt,
    });

    const durationMs = Date.now() - startedAt;

    return {
      ideas: object.ideas,
      meta: {
        provider: this.provider.name,
        model: this.provider.defaultModel,
        durationMs,
      },
    };
  }

  /**
   * Auditoria do canal a partir das métricas REAIS (YouTube Analytics) do
   * período atual + anterior. Devolve veredito, pontos fortes, o que corrigir
   * (com severidade e recomendação) e ganhos rápidos — tudo ancorado nos números.
   */
  async auditChannel(input: ChannelAuditInput): Promise<ChannelAuditResult> {
    const prompt = await loadPrompt('channel-audit', { data: JSON.stringify(input, null, 2) });
    const startedAt = Date.now();

    const { object } = await this.provider.generateJSON<ChannelAudit>({
      system:
        'Você é um analista sênior de canais do YouTube. Responda APENAS com JSON válido, sem texto adicional.',
      prompt,
      // Teto alto: a auditoria enriquecida (top vídeos + tráfego + veredito +
      // findings + ganhos rápidos) é longa; com pouco teto o JSON truncava.
      maxTokens: 4000,
    });

    return {
      ...object,
      meta: {
        provider: this.provider.name,
        model: this.provider.defaultModel,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}
