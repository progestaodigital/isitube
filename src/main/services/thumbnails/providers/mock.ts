import { nativeImage } from 'electron';
import type {
  GenerateThumbnailArgs,
  GenerateThumbnailResult,
  ImageProvider,
} from './types';

// Provider de desenvolvimento: gera um gradiente determinístico (sem custo, sem
// chave) pra a página funcionar em `npm run dev` sem uma chave Gemini real.
// Nunca é selecionado no build empacotado (o selector só cai aqui em dev).
export class MockImageProvider implements ImageProvider {
  readonly name = 'mock' as const;
  readonly model = 'mock-gradient';

  async generate(args: GenerateThumbnailArgs): Promise<GenerateThumbnailResult> {
    const width = 1280;
    const height = 720;
    const seed = hash(args.prompt + args.references.map((r) => r.kind).join(','));
    const h1 = seed % 360;
    const h2 = (h1 + 40 + (seed % 120)) % 360;
    const [r1, g1, b1] = hslToRgb(h1, 0.65, 0.45);
    const [r2, g2, b2] = hslToRgb(h2, 0.7, 0.3);

    // Buffer BGRA (formato nativo do Windows pro createFromBitmap), gradiente
    // vertical entre as duas cores derivadas do prompt.
    const buf = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      const t = y / (height - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        buf[i] = b;
        buf[i + 1] = g;
        buf[i + 2] = r;
        buf[i + 3] = 255;
      }
    }

    const img = nativeImage.createFromBitmap(buf, { width, height });
    await delay(400); // latência simulada pra UX de loading
    return { images: [{ data: img.toPNG(), mimeType: 'image/png' }], costEstimateUsd: null };
  }

  async buildDetailedPrompt(
    _reference: { data: Buffer; mimeType: string },
    instructions: string,
    _options?: { hasScene?: boolean }
  ): Promise<string> {
    const extra = instructions?.trim() ? `\n\nInstruções do criador: ${instructions.trim()}` : '';
    return (
      'Thumbnail de YouTube 16:9, cinematográfica, alto contraste.\n' +
      'PESSOA: use a foto de referência da pessoa fornecida, preservando a identidade real; uma ' +
      'única pessoa, no terço direito, do peito para cima, expressão séria.\n' +
      'PRIMEIRO PLANO: um grande maço de dinheiro segurado e projetado à câmera, do lado esquerdo.\n' +
      'TEXTO: no canto superior esquerdo, grande, maiúsculas, amarelo com contorno escuro.\n' +
      'FUNDO: escritório escuro desfocado, luz de recorte verde-petróleo atrás da cabeça.\n' +
      'ESTILO: negócios/dinheiro, dramático, sem elementos poluídos.' +
      extra
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
  const h = hDeg / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(channel(h + 1 / 3) * 255),
    Math.round(channel(h) * 255),
    Math.round(channel(h - 1 / 3) * 255),
  ];
}
