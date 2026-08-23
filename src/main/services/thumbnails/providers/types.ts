import type { ThumbnailAssetKind } from '@shared/types';

/**
 * Uma imagem de referência enviada ao modelo. `kind` diz o papel:
 * `face` = identidade do criador, `scene` = fundo/cenário, `style` = layout de
 * referência (thumb vencedora). O provider usa isso pra montar as instruções.
 */
export type ImageReference = {
  kind: ThumbnailAssetKind;
  data: Buffer;
  mimeType: string;
};

export type GenerateThumbnailArgs = {
  prompt: string;
  references: ImageReference[];
  aspectRatio: string;
};

export type GeneratedImage = {
  data: Buffer;
  mimeType: string;
};

export type GenerateThumbnailResult = {
  images: GeneratedImage[];
  /** Estimativa de custo em USD dessa chamada (null quando não aplicável, ex: mock). */
  costEstimateUsd: number | null;
};

/**
 * Abstração de motor de imagem. Espelha `AIProvider` (texto) — a UI nunca fala
 * com um provider direto, só com o service de thumbnails via IPC. Trocar Gemini
 * por outro motor é implementar essa interface e ajustar o selector.
 */
export interface ImageProvider {
  readonly name: 'gemini' | 'mock';
  readonly model: string;
  generate(args: GenerateThumbnailArgs): Promise<GenerateThumbnailResult>;
  /**
   * Lê uma imagem de referência + as instruções do criador e devolve um PROMPT
   * detalhado e estruturado pra recriar aquela thumbnail no mesmo estilo,
   * aplicando as instruções — sem descrever a identidade da pessoa da referência
   * (a identidade vem das fotos do personagem, fornecidas à parte ao gerador).
   */
  buildDetailedPrompt(
    reference: { data: Buffer; mimeType: string },
    instructions: string,
    options?: { hasScene?: boolean }
  ): Promise<string>;

  /**
   * Edita uma thumbnail já existente aplicando um ajuste em texto (ex: "muda o
   * texto", "escurece o fundo"), preservando o resto. `identityRefs` (fotos do
   * personagem) mantêm o rosto fiel durante a edição.
   */
  editImage(args: {
    baseImage: { data: Buffer; mimeType: string };
    instruction: string;
    identityRefs: ImageReference[];
  }): Promise<GenerateThumbnailResult>;
}
