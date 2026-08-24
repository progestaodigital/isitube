import { getPrisma } from '../../db';
import { getAIService } from '../ai';
import { listLibrary } from '../library';
import { getBoard, createCard, createColumn, updateCard } from '../kanban';
import type {
  IdeateInput,
  IdeasGenerateResult,
  KanbanCard,
  SavedVideoIdea,
  VideoIdeaLevel,
  VideoIdeaTrafficStrategy,
  VideoIdeaTrend,
  VideoIdeaUrgency,
  VideoIdeaVolumeTier,
} from '@shared/types';

const NO_SERVICE_MSG =
  'API key da Anthropic não configurada ou inválida. Vá em Configurações → Inteligência Artificial.';

type IdeaRow = {
  id: string;
  title: string;
  trafficStrategy: string;
  keyword: string;
  competition: string;
  volumeTier: string;
  trendDirection: string;
  contentLengthMin: number;
  hookAngle: string;
  thumbnailConcept: string;
  whyThisIdea: string;
  urgency: string;
  score: number;
  niche: string | null;
  createdAt: Date;
};

function rowToSavedIdea(row: IdeaRow): SavedVideoIdea {
  return {
    id: row.id,
    title: row.title,
    trafficStrategy: row.trafficStrategy as VideoIdeaTrafficStrategy,
    keyword: row.keyword,
    competition: row.competition as VideoIdeaLevel,
    volumeTier: row.volumeTier as VideoIdeaVolumeTier,
    trendDirection: row.trendDirection as VideoIdeaTrend,
    contentLengthMin: row.contentLengthMin,
    hookAngle: row.hookAngle,
    thumbnailConcept: row.thumbnailConcept,
    whyThisIdea: row.whyThisIdea,
    urgency: row.urgency as VideoIdeaUrgency,
    score: row.score,
    niche: row.niche,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Títulos dos vídeos mais vistos salvos na Biblioteca — referência de estilo
 *  pros títulos gerados. Vazio quando a Biblioteca está vazia. */
async function libraryStyleTitles(limit = 15): Promise<string[]> {
  try {
    const items = await listLibrary({ sort: 'mostViews' });
    return items
      .map((i) => i.title)
      .filter((t): t is string => Boolean(t && t.trim()))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function generateAndSaveIdeas(input: IdeateInput): Promise<IdeasGenerateResult> {
  const service = await getAIService();
  if (!service) throw new Error(NO_SERVICE_MSG);

  const styleTitles = await libraryStyleTitles();
  const result = await service.ideateVideos(input, styleTitles);

  const prisma = getPrisma();
  const created = await prisma.$transaction(
    result.ideas.map((idea) =>
      prisma.generatedIdea.create({
        data: {
          title: idea.title,
          trafficStrategy: idea.trafficStrategy,
          keyword: idea.keyword,
          competition: idea.competition,
          volumeTier: idea.volumeTier,
          trendDirection: idea.trendDirection,
          contentLengthMin: idea.contentLengthMin,
          hookAngle: idea.hookAngle,
          thumbnailConcept: idea.thumbnailConcept,
          whyThisIdea: idea.whyThisIdea,
          urgency: idea.urgency,
          score: idea.score,
          niche: input.niche,
        },
      })
    )
  );

  return { ideas: created.map(rowToSavedIdea), meta: result.meta };
}

export async function listSavedIdeas(): Promise<SavedVideoIdea[]> {
  const prisma = getPrisma();
  const rows = await prisma.generatedIdea.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return rows.map(rowToSavedIdea);
}

export async function deleteSavedIdea(id: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.generatedIdea.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** Promove uma ideia salva a card do Kanban (na primeira coluna), levando o
 *  título e a palavra-chave principal. */
export async function createCardFromIdea(id: string): Promise<KanbanCard> {
  const prisma = getPrisma();
  const idea = await prisma.generatedIdea.findUnique({ where: { id } });
  if (!idea || idea.deletedAt) throw new Error('Ideia não encontrada.');

  const board = await getBoard();
  let columnId = board.columns[0]?.id;
  if (!columnId) {
    const column = await createColumn('Ideias');
    columnId = column.id;
  }

  const card = await createCard(columnId, idea.title);
  return updateCard(card.id, {
    mainKeyword: idea.keyword,
    // Leva o conceito de thumbnail da ideia pro card (vira o brief no criador).
    thumbnailPrompt: idea.thumbnailConcept || null,
  });
}
