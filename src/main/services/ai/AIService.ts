import type {
  ChannelAudit,
  ChannelAuditInput,
  ChannelAuditResult,
  IdeateInput,
  IdeateResult,
  KeywordIdea,
  KeywordIdeasResult,
  VideoIdea,
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
   * Ideação: gera 8 ideias de vídeo distintas a partir do nicho + contexto
   * opcional (top vídeos, dores da audiência, temas a evitar). Cada ideia vem
   * com estratégia de tráfego, keyword, tiers, ângulo de gancho, conceito de
   * thumbnail e score composto — pronto pra ir pra produção.
   */
  async ideateVideos(input: IdeateInput, styleTitles: string[] = []): Promise<IdeateResult> {
    // Estilo de título: quando o criador salvou vídeos na Biblioteca, modelamos os
    // títulos gerados no estilo deles (linguagem, tamanho, tipo de gancho) — sem
    // copiar o tema. Vazio → segue o fluxo padrão.
    const styleReference =
      styleTitles.length > 0
        ? `\nESTILO DE TÍTULO: modele os \`title\` no estilo destes títulos que o criador salvou como referência (mesmo padrão de linguagem, comprimento e tipo de gancho). NÃO copie o tema, só o estilo:\n${styleTitles.map((t) => `- ${t}`).join('\n')}\n`
        : '';
    const prompt = await loadPrompt('video-ideas', {
      data: JSON.stringify(input, null, 2),
      styleReference,
    });
    const startedAt = Date.now();

    const { object } = await this.provider.generateJSON<{ ideas: VideoIdea[] }>({
      system:
        'Você é um estrategista de conteúdo do YouTube. Responda APENAS com JSON válido, sem texto adicional.',
      prompt,
      // 8 ideias com brief completo são longas; teto baixo trunca o JSON.
      maxTokens: 4000,
    });

    return {
      ideas: object.ideas,
      meta: {
        provider: this.provider.name,
        model: this.provider.defaultModel,
        durationMs: Date.now() - startedAt,
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
