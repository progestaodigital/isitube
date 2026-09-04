import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { getSetting, setSetting } from '../settings';
import { listLibrary } from '../library';
import {
  getBoard,
  getCard,
  createCard,
  updateCard,
  moveCard,
  createColumn,
} from '../kanban';
import type { BridgeStatus, KanbanCardPatch, LibraryItem } from '@shared/types';

/**
 * Bridge HTTP local (só 127.0.0.1) que expõe um punhado de funções do Kanban +
 * Biblioteca pra um cliente externo (ex.: um MCP do Claude Code). Roda DENTRO do
 * main process — reusa o mesmo Prisma client e a mesma lógica das telas, então
 * não há problema de dois writers. Protegido por bearer token; nunca escuta fora
 * de localhost.
 */
const HOST = '127.0.0.1';
const DEFAULT_PORT = 8760;
const ENABLED_KEY = 'bridge.enabled';
const TOKEN_KEY = 'bridge.token';
const PORT_KEY = 'bridge.port';

let server: Server | null = null;

export async function getBridgeToken(): Promise<string> {
  let token = await getSetting(TOKEN_KEY);
  if (!token) {
    token = randomBytes(24).toString('hex');
    await setSetting(TOKEN_KEY, token);
  }
  return token;
}

export async function regenerateBridgeToken(): Promise<string> {
  const token = randomBytes(24).toString('hex');
  await setSetting(TOKEN_KEY, token);
  // Reinicia o servidor pra passar a exigir o token novo.
  if (server) {
    await stopBridge();
    await startBridge();
  }
  return token;
}

export async function getBridgePort(): Promise<number> {
  const raw = await getSetting(PORT_KEY);
  const n = raw ? Number(raw) : DEFAULT_PORT;
  return Number.isFinite(n) && n > 0 && n < 65536 ? n : DEFAULT_PORT;
}

export async function getBridgeStatus(): Promise<BridgeStatus> {
  const [enabledRaw, token, port] = await Promise.all([
    getSetting(ENABLED_KEY),
    getBridgeToken(),
    getBridgePort(),
  ]);
  return {
    enabled: enabledRaw === 'true',
    running: server !== null,
    host: HOST,
    port,
    token,
  };
}

export async function startBridge(): Promise<void> {
  if (server) return;
  const token = await getBridgeToken();
  const port = await getBridgePort();
  const srv = createServer((req, res) => {
    handle(req, res, token).catch((err) =>
      sendJson(res, 500, { error: err?.message ?? String(err) })
    );
  });
  await new Promise<void>((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, HOST, () => resolve());
  });
  server = srv;
}

export async function stopBridge(): Promise<void> {
  if (!server) return;
  const srv = server;
  server = null;
  await new Promise<void>((resolve) => srv.close(() => resolve()));
}

/** Liga/desliga persistindo o setting; usado pela UI de configurações. */
export async function setBridgeEnabled(enabled: boolean): Promise<void> {
  await setSetting(ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled) await startBridge();
  else await stopBridge();
}

/** Chamado no boot: sobe o bridge se o usuário deixou habilitado. */
export async function initBridge(): Promise<void> {
  const enabled = (await getSetting(ENABLED_KEY)) === 'true';
  if (enabled) {
    try {
      await startBridge();
    } catch (err) {
      console.error('[bridge] falha ao iniciar:', err);
    }
  }
}

// ---------------------------------------------------------------------------

async function handle(req: IncomingMessage, res: ServerResponse, token: string): Promise<void> {
  if (req.headers['authorization'] !== `Bearer ${token}`) {
    return sendJson(res, 401, { error: 'unauthorized' });
  }

  const url = new URL(req.url ?? '/', `http://${HOST}`);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = req.method ?? 'GET';

  if (method === 'GET' && path === '/health') {
    return sendJson(res, 200, { ok: true, service: 'isitube-bridge' });
  }

  if (method === 'GET' && path === '/library') {
    const query = url.searchParams.get('query') ?? undefined;
    const sort = url.searchParams.get('sort') ?? undefined;
    const items = await listLibrary({
      query,
      sort: sort as 'recent' | 'oldest' | 'mostViews' | 'title' | undefined,
    });
    return sendJson(res, 200, { items: items.map(trimLibraryItem) });
  }

  if (method === 'GET' && path === '/kanban/board') {
    return sendJson(res, 200, await getBoard());
  }

  const cardId = path.match(/^\/kanban\/card\/([^/]+)$/);
  if (cardId && method === 'GET') {
    const card = await getCard(cardId[1]);
    if (!card) return sendJson(res, 404, { error: 'card não encontrado' });
    return sendJson(res, 200, card);
  }

  if (method === 'POST' && path === '/kanban/card') {
    const body = await readJson(req);
    let columnId: string | undefined =
      typeof body.columnId === 'string' ? body.columnId : undefined;
    if (!columnId) {
      const board = await getBoard();
      columnId = board.columns[0]?.id ?? (await createColumn('Ideias')).id;
    }
    const card = await createCard(columnId, typeof body.title === 'string' ? body.title : '');
    if (body.patch && typeof body.patch === 'object') {
      return sendJson(res, 200, await updateCard(card.id, sanitizePatch(body.patch)));
    }
    return sendJson(res, 200, card);
  }

  if (cardId && method === 'PATCH') {
    const body = await readJson(req);
    return sendJson(res, 200, await updateCard(cardId[1], sanitizePatch(body)));
  }

  const moveId = path.match(/^\/kanban\/card\/([^/]+)\/move$/);
  if (moveId && method === 'POST') {
    const body = await readJson(req);
    if (typeof body.toColumnId !== 'string') {
      return sendJson(res, 400, { error: 'toColumnId é obrigatório' });
    }
    const toPosition = typeof body.toPosition === 'number' ? body.toPosition : 0;
    await moveCard(moveId[1], body.toColumnId, toPosition);
    const card = await getCard(moveId[1]);
    return sendJson(res, 200, card);
  }

  return sendJson(res, 404, { error: 'rota não encontrada' });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('JSON inválido no corpo da requisição'));
      }
    });
    req.on('error', reject);
  });
}

/** Mesmo whitelist do IPC kanban:update-card — só campos conhecidos e tipados. */
function sanitizePatch(o: any): KanbanCardPatch {
  const p: KanbanCardPatch = {};
  if (typeof o.title === 'string') p.title = o.title;
  if (o.mainKeyword === null || typeof o.mainKeyword === 'string') p.mainKeyword = o.mainKeyword;
  if (o.description === null || typeof o.description === 'string') p.description = o.description;
  if (o.hook === null || typeof o.hook === 'string') p.hook = o.hook;
  if (o.thumbnailPrompt === null || typeof o.thumbnailPrompt === 'string') {
    p.thumbnailPrompt = o.thumbnailPrompt;
  }
  if (
    o.format === null ||
    (typeof o.format === 'string' && ['longo', 'short', 'live', 'estreia'].includes(o.format))
  ) {
    p.format = o.format;
  }
  if (o.script === null || typeof o.script === 'string') p.script = o.script;
  if (o.planning === null || typeof o.planning === 'string') p.planning = o.planning;
  if (Array.isArray(o.secondaryKeywords) && o.secondaryKeywords.every((k: any) => typeof k === 'string')) {
    p.secondaryKeywords = o.secondaryKeywords;
  }
  if (Array.isArray(o.tags) && o.tags.every((k: any) => typeof k === 'string')) {
    p.tags = o.tags;
  }
  if (Array.isArray(o.hashtags) && o.hashtags.every((k: any) => typeof k === 'string')) {
    p.hashtags = o.hashtags;
  }
  if (
    Array.isArray(o.chapters) &&
    o.chapters.every(
      (c: any) => c && typeof c.timestamp === 'string' && typeof c.label === 'string'
    )
  ) {
    p.chapters = o.chapters;
  }
  return p;
}

function trimLibraryItem(v: LibraryItem) {
  return {
    id: v.id,
    youtubeId: v.youtubeId,
    title: v.title,
    channelTitle: v.channelTitle ?? null,
    viewCount: v.viewCount,
    url: v.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}` : null,
  };
}
