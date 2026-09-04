import { ipcMain } from 'electron';
import {
  addReference,
  addThumbnail,
  addThumbnailFromGeneration,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  deleteThumbnail,
  exportCardThumbnail,
  getBoard,
  moveCard,
  removeReference,
  renameColumn,
  reorderColumns,
  setCoverThumbnail,
  toggleColumnCollapsed,
  updateCard,
} from '../services/kanban';
import type {
  KanbanCardPatch,
  KanbanReferenceType,
  KanbanThumbnailUpload,
} from '@shared/types';

const VALID_REF_TYPES: KanbanReferenceType[] = ['thumb', 'titulo', 'roteiro'];

export function registerKanbanHandlers(): void {
  ipcMain.handle('kanban:get-board', async () => getBoard());

  ipcMain.handle('kanban:create-column', async (_e, name: unknown) => {
    if (typeof name !== 'string') throw new Error('kanban:create-column expects a string name');
    return createColumn(name);
  });

  ipcMain.handle('kanban:rename-column', async (_e, id: unknown, name: unknown) => {
    if (typeof id !== 'string' || typeof name !== 'string') {
      throw new Error('kanban:rename-column expects (id, name)');
    }
    await renameColumn(id, name);
  });

  ipcMain.handle(
    'kanban:toggle-column-collapsed',
    async (_e, id: unknown, collapsed: unknown) => {
      if (typeof id !== 'string' || typeof collapsed !== 'boolean') {
        throw new Error('kanban:toggle-column-collapsed expects (id, collapsed)');
      }
      await toggleColumnCollapsed(id, collapsed);
    }
  );

  ipcMain.handle('kanban:delete-column', async (_e, id: unknown) => {
    if (typeof id !== 'string') throw new Error('kanban:delete-column expects an id');
    await deleteColumn(id);
  });

  ipcMain.handle('kanban:reorder-columns', async (_e, ids: unknown) => {
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string')) {
      throw new Error('kanban:reorder-columns expects an array of string ids');
    }
    await reorderColumns(ids as string[]);
  });

  ipcMain.handle('kanban:create-card', async (_e, columnId: unknown, title: unknown) => {
    if (typeof columnId !== 'string') {
      throw new Error('kanban:create-card expects a columnId');
    }
    const t = typeof title === 'string' ? title : '';
    return createCard(columnId, t);
  });

  ipcMain.handle('kanban:update-card', async (_e, cardId: unknown, patch: unknown) => {
    if (typeof cardId !== 'string') throw new Error('kanban:update-card expects a cardId');
    const p: KanbanCardPatch = {};
    if (patch && typeof patch === 'object') {
      const o = patch as Record<string, unknown>;
      if (typeof o.title === 'string') p.title = o.title;
      if (o.mainKeyword === null || typeof o.mainKeyword === 'string') {
        p.mainKeyword = o.mainKeyword as string | null;
      }
      if (o.script === null || typeof o.script === 'string') {
        p.script = o.script as string | null;
      }
      if (o.description === null || typeof o.description === 'string') {
        p.description = o.description as string | null;
      }
      if (o.hook === null || typeof o.hook === 'string') {
        p.hook = o.hook as string | null;
      }
      if (o.thumbnailPrompt === null || typeof o.thumbnailPrompt === 'string') {
        p.thumbnailPrompt = o.thumbnailPrompt as string | null;
      }
      if (o.planning === null || typeof o.planning === 'string') {
        p.planning = o.planning as string | null;
      }
      if (
        o.format === null ||
        (typeof o.format === 'string' && ['longo', 'short', 'live', 'estreia'].includes(o.format))
      ) {
        p.format = o.format as KanbanCardPatch['format'];
      }
      if (
        Array.isArray(o.secondaryKeywords) &&
        o.secondaryKeywords.every((k) => typeof k === 'string')
      ) {
        p.secondaryKeywords = o.secondaryKeywords as string[];
      }
      if (Array.isArray(o.tags) && o.tags.every((k) => typeof k === 'string')) {
        p.tags = o.tags as string[];
      }
      if (Array.isArray(o.hashtags) && o.hashtags.every((k) => typeof k === 'string')) {
        p.hashtags = o.hashtags as string[];
      }
      if (
        Array.isArray(o.chapters) &&
        o.chapters.every(
          (c) =>
            c &&
            typeof c === 'object' &&
            typeof (c as Record<string, unknown>).timestamp === 'string' &&
            typeof (c as Record<string, unknown>).label === 'string'
        )
      ) {
        p.chapters = o.chapters as KanbanCardPatch['chapters'];
      }
    }
    return updateCard(cardId, p);
  });

  ipcMain.handle(
    'kanban:move-card',
    async (_e, cardId: unknown, toColumnId: unknown, toPosition: unknown) => {
      if (
        typeof cardId !== 'string' ||
        typeof toColumnId !== 'string' ||
        typeof toPosition !== 'number'
      ) {
        throw new Error('kanban:move-card expects (cardId, toColumnId, toPosition)');
      }
      await moveCard(cardId, toColumnId, toPosition);
    }
  );

  ipcMain.handle('kanban:delete-card', async (_e, cardId: unknown) => {
    if (typeof cardId !== 'string') throw new Error('kanban:delete-card expects a cardId');
    await deleteCard(cardId);
  });

  ipcMain.handle('kanban:add-thumbnail', async (_e, cardId: unknown, upload: unknown) => {
    if (typeof cardId !== 'string') {
      throw new Error('kanban:add-thumbnail expects a cardId');
    }
    if (!upload || typeof upload !== 'object') {
      throw new Error('kanban:add-thumbnail expects an upload payload');
    }
    const o = upload as Record<string, unknown>;
    if (typeof o.base64 !== 'string' || typeof o.mimeType !== 'string') {
      throw new Error('kanban:add-thumbnail expects { base64, mimeType }');
    }
    const u: KanbanThumbnailUpload = { base64: o.base64, mimeType: o.mimeType };
    return addThumbnail(cardId, u);
  });

  ipcMain.handle(
    'kanban:add-thumbnail-from-generation',
    async (_e, cardId: unknown, generationId: unknown) => {
      if (typeof cardId !== 'string' || typeof generationId !== 'string') {
        throw new Error('kanban:add-thumbnail-from-generation expects (cardId, generationId)');
      }
      return addThumbnailFromGeneration(cardId, generationId);
    }
  );

  ipcMain.handle('kanban:export-thumbnail', async (_e, thumbnailId: unknown) => {
    if (typeof thumbnailId !== 'string') {
      throw new Error('kanban:export-thumbnail expects a thumbnailId');
    }
    return exportCardThumbnail(thumbnailId);
  });

  ipcMain.handle('kanban:delete-thumbnail', async (_e, thumbnailId: unknown) => {
    if (typeof thumbnailId !== 'string') {
      throw new Error('kanban:delete-thumbnail expects a thumbnailId');
    }
    return deleteThumbnail(thumbnailId);
  });

  ipcMain.handle('kanban:set-cover-thumbnail', async (_e, thumbnailId: unknown) => {
    if (typeof thumbnailId !== 'string') {
      throw new Error('kanban:set-cover-thumbnail expects a thumbnailId');
    }
    return setCoverThumbnail(thumbnailId);
  });

  ipcMain.handle(
    'kanban:add-reference',
    async (_e, cardId: unknown, videoId: unknown, refType: unknown) => {
      if (
        typeof cardId !== 'string' ||
        typeof videoId !== 'string' ||
        typeof refType !== 'string' ||
        !VALID_REF_TYPES.includes(refType as KanbanReferenceType)
      ) {
        throw new Error('kanban:add-reference expects (cardId, videoId, refType)');
      }
      return addReference(cardId, videoId, refType as KanbanReferenceType);
    }
  );

  ipcMain.handle('kanban:remove-reference', async (_e, referenceId: unknown) => {
    if (typeof referenceId !== 'string') {
      throw new Error('kanban:remove-reference expects a referenceId');
    }
    return removeReference(referenceId);
  });
}
