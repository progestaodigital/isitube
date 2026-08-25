#!/usr/bin/env node
// MCP server do isiTube. Expõe Biblioteca + Kanban pro Claude Code chamando o
// bridge HTTP local do app (127.0.0.1). Configuração via env:
//   ISITUBE_BASE_URL  (default http://127.0.0.1:8760)
//   ISITUBE_TOKEN     (obrigatório — o token mostrado em Configurações → Integração MCP)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.ISITUBE_BASE_URL || 'http://127.0.0.1:8760').replace(/\/$/, '');
const TOKEN = process.env.ISITUBE_TOKEN || '';

async function bridge(method, path, body) {
  if (!TOKEN) throw new Error('ISITUBE_TOKEN não configurado no MCP.');
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Não consegui falar com o isiTube em ${BASE_URL}. O app está aberto e o bridge está ativado em Configurações → Integração MCP?`
    );
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data?.error ? `isiTube: ${data.error}` : `isiTube HTTP ${res.status}`);
  }
  return data;
}

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}
function fail(err) {
  return { isError: true, content: [{ type: 'text', text: String(err?.message ?? err) }] };
}

// Campos preenchíveis de um card — compartilhados por create e update.
const CARD_FIELDS = {
  title: z.string().optional().describe('Título do card / vídeo'),
  mainKeyword: z.string().nullable().optional().describe('Palavra-chave principal'),
  description: z.string().nullable().optional().describe('Descrição do vídeo'),
  script: z.string().nullable().optional().describe('Roteiro'),
  hook: z.string().nullable().optional().describe('Gancho (primeiros 30s)'),
  thumbnailPrompt: z.string().nullable().optional().describe('Brief/conceito da thumbnail'),
  format: z
    .enum(['longo', 'short', 'live', 'estreia'])
    .nullable()
    .optional()
    .describe('Formato do vídeo: longo, short, live ou estreia'),
  tags: z.array(z.string()).optional().describe('Tags'),
  hashtags: z.array(z.string()).optional().describe('Hashtags (com #)'),
  secondaryKeywords: z.array(z.string()).optional().describe('Palavras-chave secundárias'),
  chapters: z
    .array(z.object({ timestamp: z.string(), label: z.string() }))
    .optional()
    .describe('Capítulos: [{ timestamp: "00:00", label: "..." }]'),
};

function patchFromArgs(a) {
  const p = {};
  for (const k of Object.keys(CARD_FIELDS)) {
    if (a[k] !== undefined) p[k] = a[k];
  }
  return p;
}

const server = new McpServer({ name: 'isitube', version: '1.0.0' });

server.tool(
  'isitube_library_search',
  'Busca vídeos salvos na Biblioteca do isiTube (referência de estilo/pauta). Devolve título, canal, views e URL.',
  {
    query: z.string().optional().describe('Filtra por título'),
    sort: z.enum(['recent', 'oldest', 'mostViews', 'title']).optional().describe('Ordenação'),
  },
  async ({ query, sort }) => {
    try {
      const qs = new URLSearchParams();
      if (query) qs.set('query', query);
      if (sort) qs.set('sort', sort);
      const s = qs.toString();
      return ok(await bridge('GET', `/library${s ? `?${s}` : ''}`));
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  'isitube_kanban_board',
  'Lê o board do Kanban: colunas (com id, nome, posição) e todos os cards de cada coluna com seus campos.',
  {},
  async () => {
    try {
      return ok(await bridge('GET', '/kanban/board'));
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  'isitube_get_card',
  'Lê todos os campos de um card específico do Kanban.',
  { cardId: z.string().describe('id do card') },
  async ({ cardId }) => {
    try {
      return ok(await bridge('GET', `/kanban/card/${encodeURIComponent(cardId)}`));
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  'isitube_create_card',
  'Cria um card no Kanban (por padrão na 1ª coluna) e já pode preencher os campos. Devolve o card criado com o id.',
  {
    columnId: z.string().optional().describe('Coluna destino; omitido = 1ª coluna'),
    ...CARD_FIELDS,
  },
  async (a) => {
    try {
      const { title, columnId } = a;
      const patch = patchFromArgs(a);
      delete patch.title; // title vai no nível de cima
      return ok(
        await bridge('POST', '/kanban/card', {
          columnId,
          title: title ?? '',
          patch,
        })
      );
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  'isitube_update_card',
  'Preenche/edita os campos de um card existente (título, descrição, tags, capítulos, hashtags, gancho, roteiro, keyword, thumbnailPrompt).',
  {
    cardId: z.string().describe('id do card'),
    ...CARD_FIELDS,
  },
  async (a) => {
    try {
      const { cardId } = a;
      return ok(await bridge('PATCH', `/kanban/card/${encodeURIComponent(cardId)}`, patchFromArgs(a)));
    } catch (e) {
      return fail(e);
    }
  }
);

server.tool(
  'isitube_move_card',
  'Move um card pra outra coluna (e/ou reordena). Use isitube_kanban_board pra descobrir os ids das colunas.',
  {
    cardId: z.string().describe('id do card'),
    toColumnId: z.string().describe('id da coluna destino'),
    toPosition: z.number().int().min(0).optional().describe('Posição na coluna (0 = topo)'),
  },
  async ({ cardId, toColumnId, toPosition }) => {
    try {
      return ok(
        await bridge('POST', `/kanban/card/${encodeURIComponent(cardId)}/move`, {
          toColumnId,
          toPosition: toPosition ?? 0,
        })
      );
    } catch (e) {
      return fail(e);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
