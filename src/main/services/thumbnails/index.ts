import { app, dialog, nativeImage } from 'electron';
import { writeFile } from 'node:fs/promises';
import { getPrisma } from '../../db';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import { getActivePlan } from '../license';
import { GeminiImageProvider } from './providers/gemini';
import { MockImageProvider } from './providers/mock';
import type { GeneratedImage, ImageProvider, ImageReference } from './providers/types';
import type {
  ImageUpload,
  ThumbnailAsset,
  ThumbnailAssetKind,
  ThumbnailAssetUpload,
  ThumbnailCharacter,
  ThumbnailCharacterPhoto,
  ThumbnailExportResult,
  ThumbnailGenerateInput,
  ThumbnailGenerateResult,
  ThumbnailGeneration,
  ThumbnailScene,
  ThumbnailStudioStatus,
  VideoThumbnailHit,
} from '@shared/types';

// Downscale de uploads pra manter o BLOB enxuto (fotos de celular chegam com
// vários MB). 1024px no lado maior é suficiente como referência pro modelo.
const MAX_REF_DIMENSION = 1024;
const MAX_COUNT = 4;
// Nº máx de fotos de um personagem enviadas ao modelo por geração (payload/custo).
const MAX_CHAR_PHOTOS = 8;

// ---------------------------------------------------------------------------
// Projeção Prisma (Bytes) → tipos do shared (data URL)
// ---------------------------------------------------------------------------

function toDataUrl(data: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(data).toString('base64')}`;
}

function projectAsset(a: {
  id: string;
  kind: string;
  label: string;
  data: Uint8Array;
  mimeType: string;
  width: number | null;
  height: number | null;
  sourceType: string;
  sourceVideoId: string | null;
  createdAt: Date;
}): ThumbnailAsset {
  return {
    id: a.id,
    kind: a.kind as ThumbnailAssetKind,
    label: a.label,
    dataUrl: toDataUrl(a.data, a.mimeType),
    mimeType: a.mimeType,
    width: a.width,
    height: a.height,
    sourceType: a.sourceType as 'upload' | 'library',
    sourceVideoId: a.sourceVideoId,
    createdAt: a.createdAt.toISOString(),
  };
}

function projectPhoto(p: {
  id: string;
  data: Uint8Array;
  mimeType: string;
  width: number | null;
  height: number | null;
}): ThumbnailCharacterPhoto {
  return {
    id: p.id,
    dataUrl: toDataUrl(p.data, p.mimeType),
    mimeType: p.mimeType,
    width: p.width,
    height: p.height,
  };
}

function projectCharacter(c: {
  id: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  photos: Array<{
    id: string;
    data: Uint8Array;
    mimeType: string;
    width: number | null;
    height: number | null;
  }>;
}): ThumbnailCharacter {
  return {
    id: c.id,
    name: c.name,
    notes: c.notes,
    photos: c.photos.map(projectPhoto),
    createdAt: c.createdAt.toISOString(),
  };
}

function projectScene(s: {
  id: string;
  name: string;
  data: Uint8Array;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
}): ThumbnailScene {
  return {
    id: s.id,
    name: s.name,
    dataUrl: toDataUrl(s.data, s.mimeType),
    mimeType: s.mimeType,
    width: s.width,
    height: s.height,
    createdAt: s.createdAt.toISOString(),
  };
}

function projectGeneration(g: {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  aspectRatio: string;
  refAssetIds: string;
  characterId: string | null;
  sceneId: string | null;
  data: Uint8Array;
  mimeType: string;
  costEstimateUsd: number | null;
  createdAt: Date;
}): ThumbnailGeneration {
  let refs: string[] = [];
  try {
    const parsed = JSON.parse(g.refAssetIds);
    if (Array.isArray(parsed)) refs = parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    /* ignore corrupt JSON */
  }
  return {
    id: g.id,
    prompt: g.prompt,
    provider: g.provider,
    model: g.model,
    aspectRatio: g.aspectRatio,
    refAssetIds: refs,
    characterId: g.characterId,
    sceneId: g.sceneId,
    dataUrl: toDataUrl(g.data, g.mimeType),
    mimeType: g.mimeType,
    costEstimateUsd: g.costEstimateUsd,
    createdAt: g.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Seleção de provider (plan-aware + fallback de dev)
// ---------------------------------------------------------------------------

async function getGoogleAIKey(): Promise<string | null> {
  const status = await getCredentialStatus('google_ai');
  if (!status?.hasValue) return null;
  return getCredentialPlainText('google_ai');
}

/**
 * Pro/BYOK com chave Gemini → provider real. Em dev (não empacotado), sem chave
 * real cai no mock pra a página ser demonstrável sem gastar/precisar de chave.
 * No build empacotado: Pro sem chave / Iniciante → null (UI mostra CTA/upsell).
 */
async function selectImageProvider(): Promise<ImageProvider | null> {
  const plan = await getActivePlan();
  if (plan === 'pro') {
    const key = await getGoogleAIKey();
    if (key) return new GeminiImageProvider(key);
  }
  if (!app.isPackaged) return new MockImageProvider();
  return null;
}

export async function getStudioStatus(): Promise<ThumbnailStudioStatus> {
  const provider = await selectImageProvider();
  if (provider) {
    return { canGenerate: true, provider: provider.name, blockedReason: null };
  }
  const plan = await getActivePlan();
  const blockedReason = !plan ? 'no-license' : plan === 'iniciante' ? 'iniciante' : 'no-key';
  return { canGenerate: false, provider: null, blockedReason };
}

// ---------------------------------------------------------------------------
// Helpers de imagem
// ---------------------------------------------------------------------------

function downscale(
  input: Buffer,
  mimeType: string
): { data: Buffer; mimeType: string; width: number | null; height: number | null } {
  try {
    let img = nativeImage.createFromBuffer(input);
    if (img.isEmpty()) return { data: input, mimeType, width: null, height: null };
    const size = img.getSize();
    const longSide = Math.max(size.width, size.height);
    if (longSide > MAX_REF_DIMENSION) {
      const scale = MAX_REF_DIMENSION / longSide;
      img = img.resize({
        width: Math.round(size.width * scale),
        height: Math.round(size.height * scale),
        quality: 'good',
      });
    }
    const out = img.toJPEG(85);
    const finalSize = img.getSize();
    return { data: out, mimeType: 'image/jpeg', width: finalSize.width, height: finalSize.height };
  } catch {
    // Formato que o nativeImage não decodifica — guarda o original como veio.
    return { data: input, mimeType, width: null, height: null };
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ---------------------------------------------------------------------------
// Referências de estilo (ThumbnailAsset)
// ---------------------------------------------------------------------------

function defaultLabel(kind: ThumbnailAssetKind): string {
  if (kind === 'face') return 'Rosto';
  if (kind === 'scene') return 'Cenário';
  return 'Referência de estilo';
}

export async function listAssets(kind?: ThumbnailAssetKind): Promise<ThumbnailAsset[]> {
  const rows = await getPrisma().thumbnailAsset.findMany({
    where: { deletedAt: null, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(projectAsset);
}

export async function addAssetFromUpload(upload: ThumbnailAssetUpload): Promise<ThumbnailAsset> {
  const raw = Buffer.from(upload.base64, 'base64');
  if (raw.length === 0) throw new Error('Imagem vazia.');
  const { data, mimeType, width, height } = downscale(raw, upload.mimeType);
  const row = await getPrisma().thumbnailAsset.create({
    data: {
      kind: upload.kind,
      label: upload.label?.trim() || defaultLabel(upload.kind),
      data,
      mimeType,
      width,
      height,
      sourceType: 'upload',
    },
  });
  return projectAsset(row);
}

export async function addAssetFromVideo(
  videoId: string,
  kind: ThumbnailAssetKind = 'style',
  label?: string
): Promise<ThumbnailAsset> {
  const v = await getPrisma().video.findFirst({ where: { id: videoId, deletedAt: null } });
  if (!v) throw new Error('Vídeo não encontrado.');
  const url = v.thumbnailHdUrl ?? v.thumbnailUrl;
  if (!url) throw new Error('Esse vídeo não tem thumbnail disponível.');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar a thumbnail (HTTP ${res.status}).`);
  const raw = Buffer.from(await res.arrayBuffer());
  const srcMime = res.headers.get('content-type') ?? 'image/jpeg';
  const { data, mimeType, width, height } = downscale(raw, srcMime);

  const row = await getPrisma().thumbnailAsset.create({
    data: {
      kind,
      label: label?.trim() || truncate(v.title, 40),
      data,
      mimeType,
      width,
      height,
      sourceType: 'library',
      sourceVideoId: v.id,
    },
  });
  return projectAsset(row);
}

/**
 * "Deixe o sistema escolher": pega a thumbnail do vídeo com maior outlierPercent
 * (acima da média) e materializa como asset de estilo. Reusa se já materializou.
 */
export async function pickAutoStyleRef(): Promise<ThumbnailAsset | null> {
  const v = await getPrisma().video.findFirst({
    where: {
      deletedAt: null,
      flaggedAsOutlier: true,
      OR: [{ thumbnailHdUrl: { not: null } }, { thumbnailUrl: { not: null } }],
    },
    orderBy: { outlierPercent: 'desc' },
  });
  if (!v) return null;

  const existing = await getPrisma().thumbnailAsset.findFirst({
    where: { deletedAt: null, sourceVideoId: v.id, kind: 'style' },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return projectAsset(existing);

  return addAssetFromVideo(v.id, 'style');
}

/**
 * Pega os `limit` vídeos mais vistos da BIBLIOTECA do usuário e materializa as
 * thumbnails como referências de estilo (reusa as já materializadas). Usado pra
 * pré-selecionar referências quando o usuário vem do card via "Criar thumbnail".
 */
/** Remove (soft-delete) assets de estilo duplicados que apontam pro MESMO vídeo,
 *  mantendo o mais recente. Auto-cura duplicatas criadas por corrida. */
async function dedupeStyleAssetsBySource(): Promise<void> {
  const rows = await getPrisma().thumbnailAsset.findMany({
    where: { deletedAt: null, kind: 'style', sourceVideoId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, sourceVideoId: true },
  });
  const seen = new Set<string>();
  const toDelete: string[] = [];
  for (const r of rows) {
    const key = r.sourceVideoId as string;
    if (seen.has(key)) toDelete.push(r.id);
    else seen.add(key);
  }
  if (toDelete.length > 0) {
    await getPrisma().thumbnailAsset.updateMany({
      where: { id: { in: toDelete } },
      data: { deletedAt: new Date() },
    });
  }
}

export async function pickTopStyleRefs(limit = 3): Promise<ThumbnailAsset[]> {
  await dedupeStyleAssetsBySource();
  // Pega mais candidatos e deduplica por youtubeId — a Biblioteca pode ter linhas
  // diferentes do MESMO vídeo, e não queremos a mesma thumbnail duas vezes.
  const vids = await getPrisma().video.findMany({
    where: {
      deletedAt: null,
      inLibrary: true,
      OR: [{ thumbnailHdUrl: { not: null } }, { thumbnailUrl: { not: null } }],
    },
    orderBy: { viewCount: 'desc' },
    take: limit * 5,
  });

  const seenYoutubeIds = new Set<string>();
  const assets: ThumbnailAsset[] = [];
  for (const v of vids) {
    if (assets.length >= limit) break;
    if (seenYoutubeIds.has(v.youtubeId)) continue;
    seenYoutubeIds.add(v.youtubeId);

    const existing = await getPrisma().thumbnailAsset.findFirst({
      where: { deletedAt: null, sourceVideoId: v.id, kind: 'style' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      assets.push(projectAsset(existing));
      continue;
    }
    try {
      assets.push(await addAssetFromVideo(v.id, 'style'));
    } catch {
      // pula vídeo com thumbnail inacessível
    }
  }
  return assets;
}

export async function deleteAsset(id: string): Promise<void> {
  await getPrisma().thumbnailAsset.update({ where: { id }, data: { deletedAt: new Date() } });
}

/**
 * Busca vídeos armazenados pelo título (contains) pra o usuário escolher a thumb
 * como referência de estilo. Outliers primeiro, depois por views.
 */
export async function searchVideoThumbnails(query: string): Promise<VideoThumbnailHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await getPrisma().video.findMany({
    where: {
      deletedAt: null,
      title: { contains: q },
      OR: [{ thumbnailHdUrl: { not: null } }, { thumbnailUrl: { not: null } }],
    },
    orderBy: [{ flaggedAsOutlier: 'desc' }, { viewCount: 'desc' }],
    take: 24,
    include: { channel: { select: { title: true } } },
  });
  return rows.map((v) => ({
    id: v.id,
    youtubeId: v.youtubeId,
    title: v.title,
    thumbnailUrl: v.thumbnailHdUrl ?? v.thumbnailUrl,
    channelTitle: v.channel?.title ?? null,
    viewCount: Number(v.viewCount),
    outlierPercent: v.outlierPercent,
    flaggedAsOutlier: v.flaggedAsOutlier,
  }));
}

// ---------------------------------------------------------------------------
// Personagens (identidade)
// ---------------------------------------------------------------------------

export async function listCharacters(): Promise<ThumbnailCharacter[]> {
  const rows = await getPrisma().thumbnailCharacter.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });
  return rows.map(projectCharacter);
}

export async function createCharacter(
  name: string,
  notes?: string | null
): Promise<ThumbnailCharacter> {
  const row = await getPrisma().thumbnailCharacter.create({
    data: { name: name?.trim() || 'Personagem', notes: notes?.trim() || null },
    include: { photos: true },
  });
  return projectCharacter(row);
}

export async function addCharacterPhotos(
  characterId: string,
  photos: ImageUpload[]
): Promise<ThumbnailCharacter> {
  const char = await getPrisma().thumbnailCharacter.findFirst({
    where: { id: characterId, deletedAt: null },
  });
  if (!char) throw new Error('Personagem não encontrado.');

  for (const up of photos) {
    const raw = Buffer.from(up.base64, 'base64');
    if (raw.length === 0) continue;
    const { data, mimeType, width, height } = downscale(raw, up.mimeType);
    await getPrisma().thumbnailCharacterPhoto.create({
      data: { characterId, data, mimeType, width, height },
    });
  }

  const updated = await getPrisma().thumbnailCharacter.findUniqueOrThrow({
    where: { id: characterId },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });
  return projectCharacter(updated);
}

export async function removeCharacterPhoto(photoId: string): Promise<void> {
  await getPrisma().thumbnailCharacterPhoto.delete({ where: { id: photoId } });
}

export async function renameCharacter(
  id: string,
  name: string,
  notes?: string | null
): Promise<ThumbnailCharacter> {
  await getPrisma().thumbnailCharacter.update({
    where: { id },
    data: { name: name?.trim() || 'Personagem', notes: notes?.trim() || null },
  });
  const updated = await getPrisma().thumbnailCharacter.findUniqueOrThrow({
    where: { id },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
  });
  return projectCharacter(updated);
}

export async function deleteCharacter(id: string): Promise<void> {
  await getPrisma().thumbnailCharacter.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Cenários (fundo)
// ---------------------------------------------------------------------------

export async function listScenes(): Promise<ThumbnailScene[]> {
  const rows = await getPrisma().thumbnailScene.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(projectScene);
}

export async function createScene(name: string, photo: ImageUpload): Promise<ThumbnailScene> {
  const raw = Buffer.from(photo.base64, 'base64');
  if (raw.length === 0) throw new Error('Imagem vazia.');
  const { data, mimeType, width, height } = downscale(raw, photo.mimeType);
  const row = await getPrisma().thumbnailScene.create({
    data: { name: name?.trim() || 'Cenário', data, mimeType, width, height },
  });
  return projectScene(row);
}

export async function renameScene(id: string, name: string): Promise<ThumbnailScene> {
  const row = await getPrisma().thumbnailScene.update({
    where: { id },
    data: { name: name?.trim() || 'Cenário' },
  });
  return projectScene(row);
}

export async function deleteScene(id: string): Promise<void> {
  await getPrisma().thumbnailScene.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

async function buildImageReferences(input: ThumbnailGenerateInput): Promise<ImageReference[]> {
  const references: ImageReference[] = [];

  if (input.characterId) {
    const char = await getPrisma().thumbnailCharacter.findFirst({
      where: { id: input.characterId, deletedAt: null },
      include: { photos: { orderBy: { createdAt: 'asc' }, take: MAX_CHAR_PHOTOS } },
    });
    if (char) {
      for (const p of char.photos) {
        references.push({ kind: 'face', data: Buffer.from(p.data), mimeType: p.mimeType });
      }
    }
  }

  if (input.sceneId) {
    const scene = await getPrisma().thumbnailScene.findFirst({
      where: { id: input.sceneId, deletedAt: null },
    });
    if (scene) {
      references.push({ kind: 'scene', data: Buffer.from(scene.data), mimeType: scene.mimeType });
    }
  }

  return references;
}

/**
 * Lê a imagem de uma referência de estilo + as instruções do usuário e devolve
 * um prompt detalhado e estruturado (estilo "brief de diretor de arte") pronto
 * pra colar no campo de prompt e gerar. A imagem da referência é usada só aqui,
 * pra escrever o texto — ela NUNCA vai pro gerador de imagem (é o que evita a
 * pessoa da referência vazar pra thumbnail).
 */
export async function buildPromptFromReference(
  styleAssetId: string,
  instructions: string,
  hasScene: boolean
): Promise<string> {
  const provider = await selectImageProvider();
  if (!provider) {
    throw new Error(
      'Configure sua chave do Google AI (Gemini) para gerar o prompt a partir da referência.'
    );
  }
  const asset = await getPrisma().thumbnailAsset.findFirst({
    where: { id: styleAssetId, deletedAt: null },
  });
  if (!asset) throw new Error('Referência não encontrada.');

  return provider.buildDetailedPrompt(
    { data: Buffer.from(asset.data), mimeType: asset.mimeType },
    instructions,
    { hasScene }
  );
}

/**
 * Gera um prompt detalhado a partir SÓ do texto do criador (sem referência de
 * estilo). Usado quando nenhuma referência foi selecionada.
 */
export async function buildPromptFromText(
  brief: string,
  hasScene: boolean
): Promise<string> {
  const provider = await selectImageProvider();
  if (!provider) {
    throw new Error('Configure sua chave do Google AI (Gemini) para gerar o prompt.');
  }
  return provider.buildPromptFromText(brief, { hasScene });
}

export async function generate(input: ThumbnailGenerateInput): Promise<ThumbnailGenerateResult> {
  const prompt = input.prompt?.trim();
  if (!prompt) return { success: false, message: 'Descreva a thumbnail que você quer gerar.' };

  const provider = await selectImageProvider();
  if (!provider) {
    const status = await getStudioStatus();
    const message =
      status.blockedReason === 'iniciante'
        ? 'A geração de thumbnails está disponível no plano Pro. Faça upgrade pra usar sua chave Gemini.'
        : status.blockedReason === 'no-key'
          ? 'Configure sua chave do Google AI (Gemini) em Configurações → Geração de thumbnails.'
          : 'Licença inválida — não é possível gerar agora.';
    return { success: false, message };
  }

  const references = await buildImageReferences(input);
  const aspectRatio = input.aspectRatio ?? '16:9';
  const count = Math.min(Math.max(input.count ?? 1, 1), MAX_COUNT);

  const collected: GeneratedImage[] = [];
  let costTotal: number | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < count; i++) {
    try {
      const r = await provider.generate({ prompt, references, aspectRatio });
      collected.push(...r.images);
      if (r.costEstimateUsd != null) costTotal = (costTotal ?? 0) + r.costEstimateUsd;
    } catch (err) {
      lastError = err;
      break; // não insiste se uma variação já falhou (custo/erro de prompt)
    }
  }

  if (collected.length === 0) {
    return {
      success: false,
      message: lastError instanceof Error ? lastError.message : 'Falha ao gerar thumbnail.',
    };
  }

  const refIdsJson = JSON.stringify(input.styleAssetIds ?? []);
  const perImageCost = costTotal != null ? costTotal / collected.length : null;
  const saved: ThumbnailGeneration[] = [];
  for (const img of collected) {
    const row = await getPrisma().thumbnailGeneration.create({
      data: {
        prompt,
        refAssetIds: refIdsJson,
        characterId: input.characterId ?? null,
        sceneId: input.sceneId ?? null,
        provider: provider.name,
        model: provider.model,
        aspectRatio,
        data: img.data,
        mimeType: img.mimeType,
        costEstimateUsd: perImageCost,
      },
    });
    saved.push(projectGeneration(row));
  }

  return {
    success: true,
    message: `${saved.length} thumbnail${saved.length > 1 ? 's' : ''} gerada${saved.length > 1 ? 's' : ''}.`,
    generations: saved,
  };
}

/**
 * Ajusta uma thumbnail já gerada aplicando um pedido em texto (edição via
 * Gemini). Mantém o rosto fiel reusando as fotos do personagem da geração
 * original. Salva o resultado como uma nova geração (histórico preserva as duas).
 */
export async function adjustGeneration(
  generationId: string,
  instruction: string
): Promise<ThumbnailGenerateResult> {
  const ins = instruction?.trim();
  if (!ins) return { success: false, message: 'Descreva o ajuste que você quer.' };

  const provider = await selectImageProvider();
  if (!provider) {
    const status = await getStudioStatus();
    const message =
      status.blockedReason === 'iniciante'
        ? 'Ajustar thumbnails está disponível no plano Pro.'
        : status.blockedReason === 'no-key'
          ? 'Configure sua chave do Google AI (Gemini) em Configurações → Geração de thumbnails.'
          : 'Licença inválida — não é possível ajustar agora.';
    return { success: false, message };
  }

  const gen = await getPrisma().thumbnailGeneration.findFirst({
    where: { id: generationId, deletedAt: null },
  });
  if (!gen) return { success: false, message: 'Thumbnail não encontrada.' };

  const identityRefs: ImageReference[] = [];
  if (gen.characterId) {
    const char = await getPrisma().thumbnailCharacter.findFirst({
      where: { id: gen.characterId, deletedAt: null },
      include: { photos: { orderBy: { createdAt: 'asc' }, take: MAX_CHAR_PHOTOS } },
    });
    if (char) {
      for (const p of char.photos) {
        identityRefs.push({ kind: 'face', data: Buffer.from(p.data), mimeType: p.mimeType });
      }
    }
  }

  let result;
  try {
    result = await provider.editImage({
      baseImage: { data: Buffer.from(gen.data), mimeType: gen.mimeType },
      instruction: ins,
      identityRefs,
    });
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Falha ao ajustar.' };
  }

  if (result.images.length === 0) {
    return { success: false, message: 'O modelo não retornou imagem pro ajuste.' };
  }

  const saved: ThumbnailGeneration[] = [];
  for (const img of result.images) {
    const row = await getPrisma().thumbnailGeneration.create({
      data: {
        prompt: `${gen.prompt}\n\n[ajuste] ${ins}`,
        refAssetIds: gen.refAssetIds,
        characterId: gen.characterId,
        sceneId: gen.sceneId,
        provider: provider.name,
        model: provider.model,
        aspectRatio: gen.aspectRatio,
        data: img.data,
        mimeType: img.mimeType,
        costEstimateUsd: result.costEstimateUsd,
      },
    });
    saved.push(projectGeneration(row));
  }

  return { success: true, message: 'Ajuste aplicado.', generations: saved };
}

export async function listGenerations(): Promise<ThumbnailGeneration[]> {
  const rows = await getPrisma().thumbnailGeneration.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  return rows.map(projectGeneration);
}

/**
 * Busca gerações por código (início do id) ou por termo no prompt. Query vazia
 * devolve as mais recentes. Usada pra puxar thumbs do estúdio pra um card do
 * Kanban.
 */
export async function searchGenerations(query: string): Promise<ThumbnailGeneration[]> {
  const q = query.trim();
  const rows = await getPrisma().thumbnailGeneration.findMany({
    where: q
      ? { deletedAt: null, OR: [{ id: { contains: q } }, { prompt: { contains: q } }] }
      : { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  return rows.map(projectGeneration);
}

export async function deleteGeneration(id: string): Promise<void> {
  await getPrisma().thumbnailGeneration.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function exportGeneration(id: string): Promise<ThumbnailExportResult> {
  const row = await getPrisma().thumbnailGeneration.findFirst({ where: { id, deletedAt: null } });
  if (!row) return { success: false, message: 'Geração não encontrada.' };

  const ext = /jpe?g/i.test(row.mimeType) ? 'jpg' : 'png';
  const result = await dialog.showSaveDialog({
    title: 'Salvar thumbnail',
    defaultPath: `thumbnail-${id.slice(0, 8)}.${ext}`,
    filters: [
      { name: 'Imagem', extensions: [ext] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, message: 'Exportação cancelada.' };
  }

  await writeFile(result.filePath, Buffer.from(row.data));
  return { success: true, message: 'Salvo com sucesso.', path: result.filePath };
}
