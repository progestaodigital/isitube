import type {
  ChannelAudit,
  ChannelAuditInput,
  ChannelAuditResult,
  CardSeoInput,
  CardSeoResult,
  CardHooksInput,
  CardHooksResult,
  CardScriptInput,
  CardScriptResult,
  HookVariant,
  IdeateInput,
  IdeateResult,
  KeywordIdea,
  KeywordIdeasResult,
  SeoTitleVariant,
  VideoChapter,
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
   * SEO/metadados de um vídeo específico: 3 variações de título, descrição,
   * tags, capítulos e hashtags — ancorados no conteúdo do card.
   */
  async generateSeo(input: CardSeoInput, styleTitles: string[] = []): Promise<CardSeoResult> {
    const styleReference =
      styleTitles.length > 0
        ? `\nTÍTULOS DE REFERÊNCIA (da Biblioteca do criador — modele o estilo por eles e informe o referenceTitle usado):\n${styleTitles.map((t) => `- ${t}`).join('\n')}\n`
        : '';
    const prompt = await loadPrompt('video-seo', {
      data: JSON.stringify(input, null, 2),
      styleReference,
    });
    const startedAt = Date.now();

    const { object } = await this.provider.generateJSON<{
      titleVariants: Array<{ label: string; title: string; rationale: string; referenceTitle?: string }>;
      recommendedTitle: string;
      description: string;
      tags: string[];
      chapters: VideoChapter[];
      hashtags: string[];
    }>({
      system:
        'Você é um especialista em SEO para YouTube. Responda APENAS com JSON válido, sem texto adicional.',
      prompt,
      maxTokens: 4000,
    });

    const titleVariants: SeoTitleVariant[] = object.titleVariants.map((v) => ({
      label: v.label,
      title: v.title,
      rationale: v.rationale,
      referenceTitle: v.referenceTitle ?? '',
      referenceVideoId: null, // o service de card preenche via match por título
    }));

    return {
      ...object,
      titleVariants,
      meta: {
        provider: this.provider.name,
        model: this.provider.defaultModel,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  /**
   * 5 variações de gancho (primeiros 30s), cada uma com mecanismo psicológico
   * distinto, risco de desistência e fonte de tráfego ideal.
   */
  async generateHooks(input: CardHooksInput): Promise<CardHooksResult> {
    const prompt = await loadPrompt('video-hooks', { data: JSON.stringify(input, null, 2) });
    const startedAt = Date.now();

    const { object } = await this.provider.generateJSON<{
      variants: HookVariant[];
      recommendation: string;
    }>({
      system:
        'Você é um roteirista especialista em ganchos de YouTube. Responda APENAS com JSON válido, sem texto adicional.',
      prompt,
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

  /**
   * Roteiro completo (Markdown) engenheirado pra retenção, partindo do gancho
   * já escolhido. Texto livre — usa generateText (não JSON) pra não truncar.
   */
  async generateScript(input: CardScriptInput): Promise<CardScriptResult> {
    const prompt = await loadPrompt('video-script', { data: JSON.stringify(input, null, 2) });
    const startedAt = Date.now();

    const { text } = await this.provider.generateText({
      system:
        'Você é um roteirista de YouTube especialista em retenção. Escreva o roteiro em Markdown, sem cercas de código.',
      prompt,
      maxTokens: 6000,
    });

    return {
      script: text.trim(),
      meta: {
        provider: this.provider.name,
        model: this.provider.defaultModel,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  /**
   * Conceito de thumbnail (brief visual) a partir do conteúdo do vídeo — vira o
   * texto do campo 1 do criador de thumbnails. Texto livre (generateText).
   */
  async generateThumbnailConcept(input: {
    title: string;
    keyword: string;
    contentSummary: string;
  }): Promise<string> {
    const prompt = await loadPrompt('thumbnail-concept', {
      data: JSON.stringify(input, null, 2),
    });
    const { text } = await this.provider.generateText({
      system:
        'Você é diretor de arte de thumbnails de YouTube. Responda só com o conceito, em texto corrido, sem markdown.',
      prompt,
      maxTokens: 600,
    });
    return text.trim();
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
