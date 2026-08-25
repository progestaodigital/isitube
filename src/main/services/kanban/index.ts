import { dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { getPrisma } from '../../db';
import type {
  KanbanBoard,
  KanbanCard,
  KanbanCardKeywordAnalysis,
  KanbanCardPatch,
  KanbanCardReference,
  KanbanCardThumbnail,
  KanbanColumn,
  KanbanReferenceType,
  KanbanThumbnailUpload,
  ThumbnailExportResult,
  VideoChapter,
} from '@shared/types';

const VALID_REF_TYPES: KanbanReferenceType[] = ['thumb', 'titulo', 'roteiro'];

// =============================================================================
// Board read
// =============================================================================

export async function getBoard(): Promise<KanbanBoard> {
  const prisma = getPrisma();

  // Garante que sempre exista pelo menos uma coluna — se o seed da migração
  // não rodou (DB feito antes da migration), cria a "Ideia" aqui também.
  // Idempotente: usa count() pra evitar duplicação.
  const count = await prisma.kanbanColumn.count({ where: { deletedAt: null } });
  if (count === 0) {
    await prisma.kanbanColumn.create({
      data: { name: 'Ideia', position: 0 },
    });
  }

  const columns = await prisma.kanbanColumn.findMany({
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    include: {
      cards: {
        where: { deletedAt: null },
        orderBy: { position: 'asc' },
        include: {
          thumbnails: { orderBy: { position: 'asc' } },
          references: {
            include: {
              video: {
                select: {
                  id: true,
                  title: true,
                  thumbnailUrl: true,
                  thumbnailHdUrl: true,
                  channel: { select: { title: true } },
                },
              },
            },
          },
          linkedKeyword: {
            include: {
              searches: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  // Para cards com mainKeyword mas sem linkedKeyword resolvido, tentamos
  // achar uma análise cacheada via lookup pelo termo. Isso permite "auto-link"
  // sem precisar editar o card de novo.
  const orphanTerms = new Map<string, string[]>(); // term → [cardIds]
  for (const col of columns) {
    for (const c of col.cards) {
      if (c.mainKeyword && !c.linkedKeywordId) {
        const t = c.mainKeyword.trim().toLowerCase();
        if (!t) continue;
        const list = orphanTerms.get(t) ?? [];
        list.push(c.id);
        orphanTerms.set(t, list);
      }
    }
  }

  const termAnalyses = new Map<string, KanbanCardKeywordAnalysis>();
  if (orphanTerms.size > 0) {
    const found = await prisma.keyword.findMany({
      where: { deletedAt: null, term: { in: Array.from(orphanTerms.keys()) } },
      include: {
        searches: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    for (const k of found) {
      const latest = k.searches[0];
      if (!latest) continue;
      termAnalyses.set(k.term, {
        cached: true,
        keywordId: k.id,
        term: k.term,
        scoreValue: latest.scoreValue,
        searchedAt: latest.createdAt.toISOString(),
      });
    }
  }

  return {
    columns: columns.map((col) => ({
      id: col.id,
      name: col.name,
      position: col.position,
      collapsed: col.collapsed,
      cards: col.cards.map((c) => projectCard(c, termAnalyses)),
    })),
  };
}

// =============================================================================
// Column CRUD
// =============================================================================

export async function createColumn(name: string): Promise<KanbanColumn> {
  const trimmed = name.trim() || 'Nova coluna';
  const prisma = getPrisma();
  const max = await prisma.kanbanColumn.aggregate({
    where: { deletedAt: null },
    _max: { position: true },
  });
  const nextPos = (max._max.position ?? -1) + 1;
  const col = await prisma.kanbanColumn.create({
    data: { name: trimmed, position: nextPos },
  });
  return { id: col.id, name: col.name, position: col.position, collapsed: col.collapsed, cards: [] };
}

export async function renameColumn(columnId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nome da coluna não pode ficar vazio.');
  await getPrisma().kanbanColumn.update({
    where: { id: columnId },
    data: { name: trimmed },
  });
}

export async function toggleColumnCollapsed(
  columnId: string,
  collapsed: boolean
): Promise<void> {
  await getPrisma().kanbanColumn.update({
    where: { id: columnId },
    data: { collapsed },
  });
}

export async function deleteColumn(columnId: string): Promise<void> {
  const prisma = getPrisma();
  const remaining = await prisma.kanbanColumn.count({
    where: { deletedAt: null, NOT: { id: columnId } },
  });
  if (remaining === 0) {
    throw new Error('Não dá pra apagar a última coluna — o board precisa de pelo menos uma.');
  }
  // Hard delete — cascateia cards/thumbnails/references via FK. Mais limpo que
  // soft delete pra workflow de planejamento (raramente quer "recuperar coluna").
  await prisma.kanbanColumn.delete({ where: { id: columnId } });
}

export async function reorderColumns(columnIds: string[]): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(
    columnIds.map((id, i) =>
      prisma.kanbanColumn.update({ where: { id }, data: { position: i } })
    )
  );
}

// =============================================================================
// Card CRUD
// =============================================================================

export async function getCard(cardId: string): Promise<KanbanCard | null> {
  const prisma = getPrisma();
  const card = await prisma.kanbanCard.findFirst({
    where: { id: cardId, deletedAt: null },
    include: cardInclude(),
  });
  if (!card) return null;
  return projectCard(card, new Map());
}

export async function createCard(columnId: string, title = ''): Promise<KanbanCard> {
  const prisma = getPrisma();
  const max = await prisma.kanbanCard.aggregate({
    where: { columnId, deletedAt: null },
    _max: { position: true },
  });
  const nextPos = (max._max.position ?? -1) + 1;
  const card = await prisma.kanbanCard.create({
    data: { columnId, position: nextPos, title },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

export async function updateCard(
  cardId: string,
  patch: KanbanCardPatch
): Promise<KanbanCard> {
  const prisma = getPrisma();
  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.script !== undefined) data.script = patch.script;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.hook !== undefined) data.hook = patch.hook;
  if (patch.thumbnailPrompt !== undefined) data.thumbnailPrompt = patch.thumbnailPrompt;
  if (patch.format !== undefined) data.format = patch.format;
  if (patch.secondaryKeywords !== undefined) {
    data.secondaryKeywords = JSON.stringify(patch.secondaryKeywords);
  }
  if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
  if (patch.hashtags !== undefined) data.hashtags = JSON.stringify(patch.hashtags);
  if (patch.chapters !== undefined) data.chapters = JSON.stringify(patch.chapters);
  if (patch.mainKeyword !== undefined) {
    data.mainKeyword = patch.mainKeyword;
    // Atualiza o linkedKeywordId pra refletir o estado atual:
    //   - termo vazio → desliga o link
    //   - termo bate com Keyword existente → liga
    //   - termo bate com nada → deixa null (UI mostra CTA "analisar agora")
    if (!patch.mainKeyword || !patch.mainKeyword.trim()) {
      data.linkedKeywordId = null;
    } else {
      const norm = patch.mainKeyword.trim().toLowerCase();
      const existing = await prisma.keyword.findUnique({ where: { term: norm } });
      data.linkedKeywordId = existing?.id ?? null;
    }
  }
  const card = await prisma.kanbanCard.update({
    where: { id: cardId },
    data,
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

export async function moveCard(
  cardId: string,
  toColumnId: string,
  toPosition: number
): Promise<void> {
  const prisma = getPrisma();
  const card = await prisma.kanbanCard.findUnique({ where: { id: cardId } });
  if (!card) throw new Error('Card não encontrado.');

  // Pega todos os cards do canal destino (incluindo o próprio se ele já tá lá),
  // remonta a ordem com o card inserido na posição alvo, e regrava posições.
  const targetCards = await prisma.kanbanCard.findMany({
    where: { columnId: toColumnId, deletedAt: null, NOT: { id: cardId } },
    orderBy: { position: 'asc' },
    select: { id: true },
  });

  const ids = targetCards.map((c) => c.id);
  const clampedPos = Math.max(0, Math.min(toPosition, ids.length));
  ids.splice(clampedPos, 0, cardId);

  // Se mudou de coluna, atualiza columnId primeiro pra evitar inconsistência
  // de constraint (não temos constraint hard além do FK do columnId).
  if (card.columnId !== toColumnId) {
    await prisma.kanbanCard.update({
      where: { id: cardId },
      data: { columnId: toColumnId },
    });
  }

  await prisma.$transaction(
    ids.map((id, i) =>
      prisma.kanbanCard.update({ where: { id }, data: { position: i } })
    )
  );

  // Compacta posições do canal origem (se diferente). Sem isso fica buracos
  // de position que não machucam mas ficam feios em queries de debug.
  if (card.columnId !== toColumnId) {
    const sourceCards = await prisma.kanbanCard.findMany({
      where: { columnId: card.columnId, deletedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await prisma.$transaction(
      sourceCards.map((c, i) =>
        prisma.kanbanCard.update({ where: { id: c.id }, data: { position: i } })
      )
    );
  }
}

export async function deleteCard(cardId: string): Promise<void> {
  // Hard delete — workflow de planejamento; cards cancelados ficam "fora"
  // da head do usuário e não dá pra desfazer pelo app.
  await getPrisma().kanbanCard.delete({ where: { id: cardId } });
}

// =============================================================================
// Thumbnails
// =============================================================================

export async function addThumbnail(
  cardId: string,
  upload: KanbanThumbnailUpload
): Promise<KanbanCard> {
  const prisma = getPrisma();
  const buffer = Buffer.from(upload.base64, 'base64');
  const max = await prisma.kanbanCardThumbnail.aggregate({
    where: { cardId },
    _max: { position: true },
  });
  const nextPos = (max._max.position ?? -1) + 1;

  // Primeira thumbnail vira cover automaticamente.
  const existingCount = await prisma.kanbanCardThumbnail.count({ where: { cardId } });
  const isCover = existingCount === 0;

  await prisma.kanbanCardThumbnail.create({
    data: {
      cardId,
      position: nextPos,
      data: buffer,
      mimeType: upload.mimeType,
      isCover,
    },
  });

  const card = await prisma.kanbanCard.findUniqueOrThrow({
    where: { id: cardId },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

export async function deleteThumbnail(thumbnailId: string): Promise<KanbanCard> {
  const prisma = getPrisma();
  const thumb = await prisma.kanbanCardThumbnail.findUniqueOrThrow({
    where: { id: thumbnailId },
  });
  await prisma.kanbanCardThumbnail.delete({ where: { id: thumbnailId } });
  // Se removeu a cover, promove a primeira restante (se houver) pra cover.
  if (thumb.isCover) {
    const next = await prisma.kanbanCardThumbnail.findFirst({
      where: { cardId: thumb.cardId },
      orderBy: { position: 'asc' },
    });
    if (next) {
      await prisma.kanbanCardThumbnail.update({
        where: { id: next.id },
        data: { isCover: true },
      });
    }
  }
  const card = await prisma.kanbanCard.findUniqueOrThrow({
    where: { id: thumb.cardId },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

export async function setCoverThumbnail(thumbnailId: string): Promise<KanbanCard> {
  const prisma = getPrisma();
  const thumb = await prisma.kanbanCardThumbnail.findUniqueOrThrow({
    where: { id: thumbnailId },
  });
  await prisma.$transaction([
    prisma.kanbanCardThumbnail.updateMany({
      where: { cardId: thumb.cardId, isCover: true },
      data: { isCover: false },
    }),
    prisma.kanbanCardThumbnail.update({
      where: { id: thumbnailId },
      data: { isCover: true },
    }),
  ]);
  const card = await prisma.kanbanCard.findUniqueOrThrow({
    where: { id: thumb.cardId },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

/**
 * Puxa uma thumbnail gerada no Thumbnail Studio pra dentro do card, copiando o
 * BLOB da geração pra uma KanbanCardThumbnail (fica independente da geração
 * original — apagar a geração não afeta o card).
 */
export async function addThumbnailFromGeneration(
  cardId: string,
  generationId: string
): Promise<KanbanCard> {
  const prisma = getPrisma();
  const gen = await prisma.thumbnailGeneration.findFirst({
    where: { id: generationId, deletedAt: null },
  });
  if (!gen) throw new Error('Thumbnail do estúdio não encontrada.');

  const max = await prisma.kanbanCardThumbnail.aggregate({
    where: { cardId },
    _max: { position: true },
  });
  const nextPos = (max._max.position ?? -1) + 1;
  const existingCount = await prisma.kanbanCardThumbnail.count({ where: { cardId } });

  await prisma.kanbanCardThumbnail.create({
    data: {
      cardId,
      position: nextPos,
      data: Buffer.from(gen.data),
      mimeType: gen.mimeType,
      isCover: existingCount === 0,
    },
  });

  const card = await prisma.kanbanCard.findUniqueOrThrow({
    where: { id: cardId },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

/** Baixa (salva em disco) uma thumbnail do card via dialog nativo. */
export async function exportCardThumbnail(thumbnailId: string): Promise<ThumbnailExportResult> {
  const thumb = await getPrisma().kanbanCardThumbnail.findUnique({ where: { id: thumbnailId } });
  if (!thumb) return { success: false, message: 'Thumbnail não encontrada.' };

  const ext = /jpe?g/i.test(thumb.mimeType) ? 'jpg' : 'png';
  const result = await dialog.showSaveDialog({
    title: 'Salvar thumbnail',
    defaultPath: `thumbnail-${thumbnailId.slice(0, 8)}.${ext}`,
    filters: [
      { name: 'Imagem', extensions: [ext] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) {
    return { success: false, message: 'Exportação cancelada.' };
  }
  await writeFile(result.filePath, Buffer.from(thumb.data));
  return { success: true, message: 'Salvo com sucesso.', path: result.filePath };
}

// =============================================================================
// References (vinculação com biblioteca)
// =============================================================================

export async function addReference(
  cardId: string,
  videoId: string,
  refType: KanbanReferenceType
): Promise<KanbanCard> {
  if (!VALID_REF_TYPES.includes(refType)) {
    throw new Error(`Tipo de referência inválido: ${refType}`);
  }
  const prisma = getPrisma();
  await prisma.kanbanCardReference.upsert({
    where: {
      cardId_videoId_refType: { cardId, videoId, refType },
    },
    update: {},
    create: { cardId, videoId, refType },
  });
  const card = await prisma.kanbanCard.findUniqueOrThrow({
    where: { id: cardId },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

export async function removeReference(referenceId: string): Promise<KanbanCard> {
  const prisma = getPrisma();
  const ref = await prisma.kanbanCardReference.findUniqueOrThrow({
    where: { id: referenceId },
  });
  await prisma.kanbanCardReference.delete({ where: { id: referenceId } });
  const card = await prisma.kanbanCard.findUniqueOrThrow({
    where: { id: ref.cardId },
    include: cardInclude(),
  });
  return projectCard(card, new Map());
}

// =============================================================================
// Helpers
// =============================================================================

function cardInclude() {
  return {
    thumbnails: { orderBy: { position: 'asc' as const } },
    references: {
      include: {
        video: {
          select: {
            id: true,
            title: true,
            thumbnailUrl: true,
            thumbnailHdUrl: true,
            channel: { select: { title: true } },
          },
        },
      },
    },
    linkedKeyword: {
      include: {
        searches: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
    },
  };
}

type DbCard = {
  id: string;
  columnId: string;
  position: number;
  title: string;
  mainKeyword: string | null;
  linkedKeywordId: string | null;
  secondaryKeywords: string | null;
  description: string | null;
  tags: string | null;
  chapters: string | null;
  hashtags: string | null;
  hook: string | null;
  thumbnailPrompt: string | null;
  format: string | null;
  script: string | null;
  createdAt: Date;
  updatedAt: Date;
  thumbnails: Array<{
    id: string;
    position: number;
    data: Buffer | Uint8Array;
    mimeType: string;
    isCover: boolean;
  }>;
  references: Array<{
    id: string;
    videoId: string;
    refType: string;
    video?: {
      id: string;
      title: string;
      thumbnailUrl: string | null;
      thumbnailHdUrl: string | null;
      channel?: { title: string } | null;
    } | null;
  }>;
  linkedKeyword?: {
    id: string;
    term: string;
    searches: Array<{
      scoreValue: number | null;
      createdAt: Date;
    }>;
  } | null;
};

function projectCard(
  c: DbCard,
  termAnalysisLookup: Map<string, KanbanCardKeywordAnalysis>
): KanbanCard {
  let secondaryKeywords: string[] = [];
  if (c.secondaryKeywords) {
    try {
      const parsed = JSON.parse(c.secondaryKeywords);
      if (Array.isArray(parsed)) {
        secondaryKeywords = parsed.filter((s) => typeof s === 'string');
      }
    } catch {
      secondaryKeywords = [];
    }
  }

  const thumbnails: KanbanCardThumbnail[] = c.thumbnails.map((t) => ({
    id: t.id,
    position: t.position,
    isCover: t.isCover,
    mimeType: t.mimeType,
    dataUrl: bufferToDataUrl(t.data, t.mimeType),
  }));

  const coverThumb = thumbnails.find((t) => t.isCover);

  const references: KanbanCardReference[] = c.references
    .filter((r) => VALID_REF_TYPES.includes(r.refType as KanbanReferenceType))
    .map((r) => ({
      id: r.id,
      videoId: r.videoId,
      refType: r.refType as KanbanReferenceType,
      videoTitle: r.video?.title ?? '(vídeo removido)',
      videoThumbnailUrl: r.video?.thumbnailHdUrl ?? r.video?.thumbnailUrl ?? null,
      videoChannelTitle: r.video?.channel?.title ?? null,
    }));

  let keywordAnalysis: KanbanCardKeywordAnalysis | null = null;
  if (c.linkedKeyword) {
    const latest = c.linkedKeyword.searches[0];
    if (latest) {
      keywordAnalysis = {
        cached: true,
        keywordId: c.linkedKeyword.id,
        term: c.linkedKeyword.term,
        scoreValue: latest.scoreValue,
        searchedAt: latest.createdAt.toISOString(),
      };
    }
  } else if (c.mainKeyword) {
    const norm = c.mainKeyword.trim().toLowerCase();
    const found = termAnalysisLookup.get(norm);
    if (found) {
      keywordAnalysis = found;
    } else {
      keywordAnalysis = { cached: false, term: c.mainKeyword };
    }
  }

  return {
    id: c.id,
    columnId: c.columnId,
    position: c.position,
    title: c.title,
    mainKeyword: c.mainKeyword,
    keywordAnalysis,
    secondaryKeywords,
    description: c.description,
    tags: parseStringArray(c.tags),
    chapters: parseChapters(c.chapters),
    hashtags: parseStringArray(c.hashtags),
    hook: c.hook,
    thumbnailPrompt: c.thumbnailPrompt,
    format: (c.format as KanbanCard['format']) ?? null,
    script: c.script,
    thumbnails,
    references,
    coverThumbnailId: coverThumb?.id ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function parseChapters(json: string | null): VideoChapter[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.timestamp === 'string' && typeof c.label === 'string')
      .map((c) => ({ timestamp: c.timestamp, label: c.label }));
  } catch {
    return [];
  }
}

function bufferToDataUrl(data: Buffer | Uint8Array, mimeType: string): string {
  const buf = data instanceof Buffer ? data : Buffer.from(data);
  return `data:${mimeType};base64,${buf.toString('base64')}`;
}
