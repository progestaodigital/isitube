import { ipcMain } from 'electron';
import {
  addAssetFromUpload,
  addAssetFromVideo,
  addCharacterPhotos,
  adjustGeneration,
  buildPromptFromReference,
  buildPromptFromText,
  createCharacter,
  createScene,
  deleteAsset,
  deleteCharacter,
  deleteGeneration,
  deleteScene,
  exportGeneration,
  generate,
  getStudioStatus,
  listAssets,
  listCharacters,
  listGenerations,
  listScenes,
  pickAutoStyleRef,
  pickTopStyleRefs,
  removeCharacterPhoto,
  renameCharacter,
  renameScene,
  searchGenerations,
  searchVideoThumbnails,
} from '../services/thumbnails';
import { getUsdBrlRate } from '../services/fx';
import type {
  ImageUpload,
  ThumbnailAssetKind,
  ThumbnailAssetUpload,
  ThumbnailGenerateInput,
} from '@shared/types';

const VALID_KINDS = new Set<ThumbnailAssetKind>(['face', 'scene', 'style']);

function isKind(v: unknown): v is ThumbnailAssetKind {
  return typeof v === 'string' && VALID_KINDS.has(v as ThumbnailAssetKind);
}

function isUpload(v: unknown): v is ImageUpload {
  return (
    !!v &&
    typeof (v as ImageUpload).base64 === 'string' &&
    typeof (v as ImageUpload).mimeType === 'string'
  );
}

export function registerThumbnailsHandlers(): void {
  // ---- Referências de estilo (assets) ----
  ipcMain.handle('thumbnails:list-assets', async (_e, kind: unknown) => {
    if (kind !== undefined && !isKind(kind)) {
      throw new Error('thumbnails:list-assets kind inválido');
    }
    return listAssets(kind as ThumbnailAssetKind | undefined);
  });

  ipcMain.handle('thumbnails:add-upload', async (_e, upload: unknown) => {
    const u = upload as ThumbnailAssetUpload;
    if (!isUpload(u) || !isKind(u.kind)) {
      throw new Error('thumbnails:add-upload payload inválido');
    }
    return addAssetFromUpload(u);
  });

  ipcMain.handle(
    'thumbnails:add-from-video',
    async (_e, videoId: unknown, kind: unknown, label: unknown) => {
      if (typeof videoId !== 'string') {
        throw new Error('thumbnails:add-from-video expects a string id');
      }
      return addAssetFromVideo(
        videoId,
        isKind(kind) ? kind : undefined,
        typeof label === 'string' ? label : undefined
      );
    }
  );

  ipcMain.handle('thumbnails:pick-auto-ref', async () => pickAutoStyleRef());

  ipcMain.handle('thumbnails:pick-top-refs', async (_e, limit: unknown) =>
    pickTopStyleRefs(typeof limit === 'number' ? limit : 3)
  );

  ipcMain.handle('thumbnails:delete-asset', async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('thumbnails:delete-asset expects a string id');
    return deleteAsset(id);
  });

  ipcMain.handle('thumbnails:search-videos', async (_e, query: unknown) => {
    if (typeof query !== 'string') throw new Error('thumbnails:search-videos expects a string');
    return searchVideoThumbnails(query);
  });

  // ---- Personagens ----
  ipcMain.handle('thumbnails:list-characters', async () => listCharacters());

  ipcMain.handle('thumbnails:create-character', async (_e, name: unknown, notes: unknown) => {
    if (typeof name !== 'string') throw new Error('thumbnails:create-character expects a name');
    return createCharacter(name, typeof notes === 'string' ? notes : null);
  });

  ipcMain.handle(
    'thumbnails:add-character-photos',
    async (_e, characterId: unknown, photos: unknown) => {
      if (typeof characterId !== 'string') {
        throw new Error('thumbnails:add-character-photos expects a character id');
      }
      if (!Array.isArray(photos) || !photos.every(isUpload)) {
        throw new Error('thumbnails:add-character-photos expects an array of uploads');
      }
      return addCharacterPhotos(characterId, photos as ImageUpload[]);
    }
  );

  ipcMain.handle('thumbnails:remove-character-photo', async (_e, photoId: unknown) => {
    if (typeof photoId !== 'string') {
      throw new Error('thumbnails:remove-character-photo expects a photo id');
    }
    return removeCharacterPhoto(photoId);
  });

  ipcMain.handle(
    'thumbnails:rename-character',
    async (_e, id: unknown, name: unknown, notes: unknown) => {
      if (typeof id !== 'string' || typeof name !== 'string') {
        throw new Error('thumbnails:rename-character payload inválido');
      }
      return renameCharacter(id, name, typeof notes === 'string' ? notes : null);
    }
  );

  ipcMain.handle('thumbnails:delete-character', async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('thumbnails:delete-character expects an id');
    return deleteCharacter(id);
  });

  // ---- Cenários ----
  ipcMain.handle('thumbnails:list-scenes', async () => listScenes());

  ipcMain.handle('thumbnails:create-scene', async (_e, name: unknown, photo: unknown) => {
    if (typeof name !== 'string' || !isUpload(photo)) {
      throw new Error('thumbnails:create-scene payload inválido');
    }
    return createScene(name, photo);
  });

  ipcMain.handle('thumbnails:rename-scene', async (_e, id: unknown, name: unknown) => {
    if (typeof id !== 'string' || typeof name !== 'string') {
      throw new Error('thumbnails:rename-scene payload inválido');
    }
    return renameScene(id, name);
  });

  ipcMain.handle('thumbnails:delete-scene', async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('thumbnails:delete-scene expects an id');
    return deleteScene(id);
  });

  // ---- Geração ----
  ipcMain.handle('thumbnails:generate', async (_e, input: unknown) => {
    const i = input as ThumbnailGenerateInput;
    if (!i || typeof i.prompt !== 'string') {
      throw new Error('thumbnails:generate payload inválido');
    }
    return generate({
      prompt: i.prompt,
      characterId: typeof i.characterId === 'string' ? i.characterId : null,
      sceneId: typeof i.sceneId === 'string' ? i.sceneId : null,
      styleAssetIds: Array.isArray(i.styleAssetIds)
        ? i.styleAssetIds.filter((x): x is string => typeof x === 'string')
        : [],
      aspectRatio: typeof i.aspectRatio === 'string' ? i.aspectRatio : undefined,
      count: typeof i.count === 'number' ? i.count : undefined,
    });
  });

  ipcMain.handle('thumbnails:adjust', async (_e, generationId: unknown, instruction: unknown) => {
    if (typeof generationId !== 'string') {
      throw new Error('thumbnails:adjust expects a generation id');
    }
    return adjustGeneration(generationId, typeof instruction === 'string' ? instruction : '');
  });

  ipcMain.handle(
    'thumbnails:build-prompt',
    async (_e, styleAssetId: unknown, instructions: unknown, hasScene: unknown) => {
      const brief = typeof instructions === 'string' ? instructions : '';
      const scene = hasScene === true;
      // Com referência → lê a imagem; sem referência → expande só o texto.
      if (typeof styleAssetId === 'string' && styleAssetId) {
        return buildPromptFromReference(styleAssetId, brief, scene);
      }
      return buildPromptFromText(brief, scene);
    }
  );

  ipcMain.handle('thumbnails:list-generations', async () => listGenerations());

  ipcMain.handle('thumbnails:search-generations', async (_e, query: unknown) => {
    return searchGenerations(typeof query === 'string' ? query : '');
  });

  ipcMain.handle('thumbnails:delete-generation', async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('thumbnails:delete-generation expects a string id');
    return deleteGeneration(id);
  });

  ipcMain.handle('thumbnails:export', async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('thumbnails:export expects a string id');
    return exportGeneration(id);
  });

  ipcMain.handle('thumbnails:status', async () => getStudioStatus());

  ipcMain.handle('thumbnails:usd-brl-rate', async () => getUsdBrlRate());
}
