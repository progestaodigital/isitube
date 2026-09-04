import { protocol } from 'electron';
import { getPrisma } from '../../db';

/**
 * Protocolo custom que serve os BLOBs de thumbnail do Kanban sob demanda.
 *
 * Antes as imagens iam embutidas no payload do board como data URL base64 —
 * com N cards x M thumbnails de 100kB-1MB isso fazia o `kanban:get-board`
 * transferir dezenas de MB por IPC a cada refresh, o que travava a abertura
 * da tela. Agora o board carrega só os ids e o Chromium busca cada imagem
 * em paralelo, fora da thread do JS, e cacheia (o conteúdo de um id nunca
 * muda — thumbnail é imutável, editar cria outra linha).
 */
export const KANBAN_THUMB_SCHEME = 'isitube-thumb';

/** URL estável de uma thumbnail. Servida por `registerKanbanThumbnailProtocol`. */
export function kanbanThumbnailUrl(thumbnailId: string): string {
  return `${KANBAN_THUMB_SCHEME}://kanban/${thumbnailId}`;
}

/**
 * Precisa rodar ANTES do `app.whenReady()` — o Chromium congela a tabela de
 * schemes no boot. Sem isso o `<img src="isitube-thumb://...">` é tratado
 * como scheme desconhecido e nem chega no handler.
 */
export function registerKanbanThumbnailScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: KANBAN_THUMB_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: false },
    },
  ]);
}

/** Roda depois do app ready. */
export function registerKanbanThumbnailProtocol(): void {
  protocol.handle(KANBAN_THUMB_SCHEME, async (request) => {
    try {
      const id = new URL(request.url).pathname.replace(/^\//, '');
      if (!id) return new Response('missing id', { status: 400 });

      const thumb = await getPrisma().kanbanCardThumbnail.findUnique({
        where: { id },
        select: { data: true, mimeType: true },
      });
      if (!thumb) return new Response('not found', { status: 404 });

      const bytes = Buffer.from(thumb.data);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': thumb.mimeType || 'image/png',
          'Content-Length': String(bytes.byteLength),
          // Conteúdo imutável por id — pode cachear pra sempre.
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (err) {
      console.error('[kanban-thumb] falha ao servir thumbnail:', err);
      return new Response('internal error', { status: 500 });
    }
  });
}
