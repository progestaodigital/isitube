import type {
  GenerateThumbnailArgs,
  GenerateThumbnailResult,
  ImageProvider,
} from './types';
import { recordFailure, recordSuccess } from '../../telemetry/providers';

// "Nano Banana" — modelo de geração/edição de imagem do Gemini. Aceita várias
// imagens de referência (inline) + texto e mantém identidade do sujeito.
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// Modelo de visão/texto (barato) pra ler a referência e escrever o prompt.
// gemini-2.5-flash foi descontinuado para contas novas; a própria API indica
// gemini-3.6-flash como substituto.
const VISION_MODEL = 'gemini-3.6-flash';

const BUILD_META = [
  'Você é diretor de arte especialista em thumbnails de YouTube. Você recebeu UMA imagem de',
  'referência e as INSTRUÇÕES do criador (no fim). Escreva UM prompt final, detalhado e',
  'estruturado, em português, para um modelo de geração de imagem recriar uma thumbnail no',
  'MESMO estilo visual da referência (composição, enquadramento, paleta de cores, iluminação,',
  'tipografia e posição do texto, elementos gráficos e clima), aplicando as instruções do criador.',
  '',
  'REGRAS:',
  '- A identidade da pessoa vem de FOTOS fornecidas separadamente ao gerador. No prompt, instrua:',
  '  "use a foto de referência da pessoa fornecida, preservando ao máximo a identidade real',
  '  (formato do rosto, cabelo, pele, olhos)". NUNCA descreva a aparência ou identidade da pessoa',
  '  que aparece na imagem de referência. Deixe explícito que a thumbnail tem UMA única pessoa — a',
  '  das fotos.',
  '- Descreva a POSE, o GESTO e os ELEMENTOS (ex.: segurando um maço de dinheiro projetado à',
  '  câmera) para o gerador reproduzir no personagem.',
  '- Aplique fielmente as instruções do criador (texto exato entre aspas, expressão, "sem logo").',
  '- Organize em seções claras: PESSOA, ELEMENTOS EM PRIMEIRO PLANO, COMPOSIÇÃO, TEXTO,',
  '  FUNDO/CENÁRIO, ILUMINAÇÃO, ESTILO VISUAL, PRIORIDADE VISUAL. Seja específico e detalhado.',
  '- Formato 16:9 (1280x720), alto CTR, legível quando pequeno (~168x94).',
  '- Responda APENAS com o prompt final, sem comentários seus e sem code fence.',
].join('\n');

// Preço aproximado por imagem gerada. Usado só pra exibir uma estimativa no
// histórico — não é cobrança real (a cobrança é direta na conta Google do user).
const COST_PER_IMAGE_USD = 0.04;

function buildInstruction(args: GenerateThumbnailArgs): string {
  const kinds = new Set(args.references.map((r) => r.kind));
  const hasStyle = kinds.has('style');
  const hasFace = kinds.has('face');
  const lines = [
    `Gere UMA imagem de thumbnail de YouTube no formato ${args.aspectRatio} (ex: 1280x720), alto contraste, foco visual claro e composição otimizada para CTR.`,
    'As imagens anexadas têm papéis diferentes — respeite cada papel:',
  ];
  if (hasFace) {
    lines.push(
      '- Fotos da PESSOA (personagem): esta é a ÚNICA pessoa que pode aparecer na thumbnail. Mantenha o rosto, o cabelo e a fisionomia fiéis a ESTAS fotos, sem distorcer. A thumbnail tem exatamente UMA pessoa — a destas fotos.'
    );
  }
  if (kinds.has('scene')) {
    lines.push('- Imagem de CENÁRIO: use como fundo/ambiente da cena.');
  }
  if (hasStyle) {
    lines.push(
      '- Imagem de REFERÊNCIA DE ESTILO: use SOMENTE como inspiração visual — enquadramento, paleta de cores, iluminação, posicionamento do texto e presença de elementos gráficos (ex.: um maço de dinheiro em destaque). ATENÇÃO CRÍTICA: NÃO copie, NÃO inclua e NÃO misture a pessoa/rosto que aparece na referência — ela NÃO é um personagem, é apenas um molde de estilo. Se a referência mostra alguém segurando dinheiro, faça o SEU personagem (o das fotos da PESSOA) segurar o dinheiro — nunca traga a pessoa da referência pra dentro da imagem.'
    );
  }
  if (hasFace) {
    lines.push('REGRA ABSOLUTA: a imagem final contém UMA só pessoa — o personagem das fotos. Nunca coloque duas pessoas.');
  }
  lines.push(`Instruções do criador: ${args.prompt}`);
  return lines.join('\n');
}

export class GeminiImageProvider implements ImageProvider {
  readonly name = 'gemini' as const;
  readonly model = MODEL;

  constructor(private readonly apiKey: string) {}

  async generate(args: GenerateThumbnailArgs): Promise<GenerateThumbnailResult> {
    const parts: Array<Record<string, unknown>> = [{ text: buildInstruction(args) }];
    for (const ref of args.references) {
      parts.push({
        inline_data: { mime_type: ref.mimeType, data: ref.data.toString('base64') },
      });
    }

    let json: any;
    try {
      const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
      });

      if (!res.ok) {
        let msg = `Gemini API error ${res.status}`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body?.error?.message) msg = body.error.message;
        } catch {
          /* swallow non-JSON */
        }
        throw new Error(msg);
      }

      json = await res.json();
      recordSuccess('gemini-image');
    } catch (err) {
      recordFailure('gemini-image', err);
      throw err;
    }

    const candidateParts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const images = candidateParts
      .map((p) => p?.inlineData ?? p?.inline_data)
      .filter((d) => d && typeof d.data === 'string')
      .map((d) => ({
        data: Buffer.from(d.data as string, 'base64'),
        mimeType: (d.mimeType ?? d.mime_type ?? 'image/png') as string,
      }));

    if (images.length === 0) {
      // Modelo às vezes devolve só texto (recusa por safety / prompt vago).
      // Superfície o motivo em vez de um erro genérico.
      const textPart = candidateParts.find((p) => typeof p?.text === 'string')?.text as
        | string
        | undefined;
      throw new Error(
        textPart
          ? `O Gemini não retornou imagem: ${textPart.slice(0, 200)}`
          : 'O Gemini não retornou nenhuma imagem pra esse pedido. Tente reformular o prompt.'
      );
    }

    return { images, costEstimateUsd: COST_PER_IMAGE_USD };
  }

  async buildDetailedPrompt(
    reference: { data: Buffer; mimeType: string },
    instructions: string,
    options?: { hasScene?: boolean }
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const sceneRule = options?.hasScene
      ? '\n- FUNDO/CENÁRIO: uma imagem de CENÁRIO será fornecida separadamente ao gerador. NÃO invente nem descreva outro fundo — instrua a usar EXATAMENTE o cenário fornecido como fundo/ambiente, descrevendo só como integrar a pessoa a ele (profundidade, separação do fundo, iluminação coerente). IGNORE o fundo da imagem de referência.'
      : '';
    const text = `${BUILD_META}${sceneRule}\n\nINSTRUÇÕES DO CRIADOR:\n${
      instructions?.trim() || '(sem instruções adicionais — mantenha o estilo da referência)'
    }`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text },
            {
              inline_data: {
                mime_type: reference.mimeType,
                data: reference.data.toString('base64'),
              },
            },
          ],
        },
      ],
    };

    let json: any;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = `Gemini vision error ${res.status}`;
        try {
          const b = (await res.json()) as { error?: { message?: string } };
          if (b?.error?.message) msg = b.error.message;
        } catch {
          /* swallow non-JSON */
        }
        throw new Error(msg);
      }
      json = await res.json();
      recordSuccess('gemini-image');
    } catch (err) {
      recordFailure('gemini-image', err);
      throw err;
    }

    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    return parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join(' ')
      .trim();
  }
}
