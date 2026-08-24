import { getAIService } from '../ai';
import { getCard, updateCard } from '../kanban';
import { getConnectionStatus } from '../youtube-connect';
import { listLibrary } from '../library';
import type { CardHooksResult, CardSeoResponse, KanbanCard } from '@shared/types';
import type { AIService } from '../ai/AIService';

const NO_SERVICE_MSG =
  'API key da Anthropic não configurada ou inválida. Vá em Configurações → Inteligência Artificial.';

async function requireService(): Promise<AIService> {
  const service = await getAIService();
  if (!service) throw new Error(NO_SERVICE_MSG);
  return service;
}

async function requireCard(cardId: string): Promise<KanbanCard> {
  const card = await getCard(cardId);
  if (!card) throw new Error('Card não encontrado.');
  return card;
}

/** Nicho/contexto do canal conectado (título do canal). Vazio se não conectado. */
async function channelNiche(): Promise<string> {
  try {
    const status = await getConnectionStatus();
    return status.channelTitle ?? '';
  } catch {
    return '';
  }
}

/** Vídeos mais vistos da Biblioteca (id + título) — referência de estilo pros
 *  títulos e origem da referência de título vinculada ao card. */
async function libraryStyleItems(limit = 15): Promise<Array<{ id: string; title: string }>> {
  try {
    const items = await listLibrary({ sort: 'mostViews' });
    return items
      .filter((i) => Boolean(i.title && i.title.trim()))
      .slice(0, limit)
      .map((i) => ({ id: i.id, title: i.title }));
  } catch {
    return [];
  }
}

/** Gera SEO/metadados e PREENCHE os campos do card (título, descrição, tags,
 *  capítulos, hashtags). Modela os títulos no estilo da Biblioteca e devolve, por
 *  variante, qual título de referência inspirou (+ o id do vídeo pra vincular). */
export async function generateCardSeo(cardId: string): Promise<CardSeoResponse> {
  const service = await requireService();
  const card = await requireCard(cardId);
  const niche = await channelNiche();
  const contentSummary = card.script?.trim() || card.hook?.trim() || card.title;

  const libItems = await libraryStyleItems();
  const styleTitles = libItems.map((i) => i.title);

  const seo = await service.generateSeo(
    {
      title: card.title,
      keyword: card.mainKeyword ?? card.title,
      niche,
      contentSummary,
      secondaryKeywords: card.secondaryKeywords,
    },
    styleTitles
  );

  // Liga o referenceTitle de cada variante ao vídeo da Biblioteca (match por título).
  const byTitle = new Map(libItems.map((i) => [i.title.trim().toLowerCase(), i.id]));
  seo.titleVariants = seo.titleVariants.map((v) => ({
    ...v,
    referenceVideoId: v.referenceTitle
      ? byTitle.get(v.referenceTitle.trim().toLowerCase()) ?? null
      : null,
  }));

  const updated = await updateCard(cardId, {
    title: seo.recommendedTitle || card.title,
    description: seo.description,
    tags: seo.tags,
    chapters: seo.chapters,
    hashtags: seo.hashtags,
  });

  return { seo, card: updated };
}

/** Gera 5 ganchos. NÃO preenche o card — o usuário escolhe um (que aí vira o
 *  campo `hook` via kanban.updateCard). */
export async function generateCardHooks(cardId: string): Promise<CardHooksResult> {
  const service = await requireService();
  const card = await requireCard(cardId);
  const niche = await channelNiche();

  return service.generateHooks({
    title: card.title,
    keyword: card.mainKeyword ?? card.title,
    niche,
  });
}

/** Gera o roteiro a partir do gancho JÁ escolhido no card e preenche `script`. */
export async function generateCardScript(
  cardId: string,
  targetLengthMin: number
): Promise<KanbanCard> {
  const service = await requireService();
  const card = await requireCard(cardId);
  if (!card.hook || !card.hook.trim()) {
    throw new Error('Escolha um gancho antes de gerar o roteiro.');
  }
  const niche = await channelNiche();
  const length = Math.max(2, Math.min(60, Math.round(targetLengthMin) || 8));

  const result = await service.generateScript({
    title: card.title,
    hook: card.hook,
    keyword: card.mainKeyword ?? card.title,
    niche,
    targetLengthMin: length,
  });

  return updateCard(cardId, { script: result.script });
}
