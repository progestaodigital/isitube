import type { FetchedVideoMetadata, VideoMetadataProvider } from './types';
import {
  delay,
  pick,
  rangeInt,
  rng,
  strHash,
  svgVideoThumbnailDataUrl,
} from '../../channels/providers/utils';

const CATEGORIES = [
  'Educação',
  'Estilo de vida',
  'Tecnologia',
  'Entretenimento',
  'Como fazer',
  'Pessoas e blogs',
  'Ciência e tecnologia',
];

const TAG_BANK = [
  'youtube', 'tutorial', 'dicas', 'iniciantes', '2026', 'brasil',
  'criadores', 'conteúdo', 'estratégia', 'crescimento',
  'algoritmo', 'engajamento', 'monetização', 'marketing',
  'produtividade', 'rotina', 'reels', 'shorts', 'live',
  'thumbnail', 'roteiro', 'edição', 'análise',
];

const DESCRIPTION_INTROS = [
  'Olá pessoal, tudo bem? Bem-vindos ao mais novo vídeo do canal!',
  'Fala galera, voltei com mais um vídeo pra vocês.',
  'E aí pessoal! Hoje eu trago um conteúdo que vocês me pediram muito.',
  'Salve família! Vamos pra mais um vídeo, e esse aqui veio direto da caixa de comentários.',
];

const DESCRIPTION_BODIES = [
  'Esse vídeo é resultado de meses de estudo e prática. Se você quer realmente dominar isso, leva o vídeo até o final, vou compartilhar tudo o que aprendi.',
  'Eu já fiz vários testes com isso no canal e finalmente reuni o que funciona de verdade. Vai ter dica que vocês não vão ver em lugar nenhum.',
  'Vou explicar do zero, sem pular passo. Se você é iniciante, beleza. Se já tem experiência, vai pegar uns insights novos com certeza.',
  'Levei meses pra montar essa estrutura. O que tô compartilhando aqui é exatamente o que eu uso no meu dia a dia.',
];

const CTA_TEMPLATES = [
  'Se esse vídeo te ajudou, deixa o like e se inscreve no canal! Comenta aqui embaixo o que você achou.',
  'Curtiu? Compartilha com aquele amigo que precisa ver isso. E ativa o sininho pra não perder nenhum vídeo novo.',
  'Espero que tenham gostado! Se quiser mais conteúdo desse, é só pedir nos comentários — leio todos.',
];

/**
 * Phase 5 mock — Phase 8 will replace this with real YouTube Data API calls
 * to videos.list with part=snippet,topicDetails,liveStreamingDetails. For now
 * we generate a realistic-feeling Brazilian-creator-style description and a
 * tag list, all deterministic from the video's youtube id.
 */
export class YouTubeMockMetadataProvider implements VideoMetadataProvider {
  readonly name = 'youtube-metadata-mock';

  async fetchMetadata(
    videoYoutubeId: string,
    videoTitle: string,
    videoDurationSec?: number | null
  ): Promise<FetchedVideoMetadata> {
    await delay(500, 1300);

    const seed = strHash(videoYoutubeId) ^ 0xcafe;
    const rand = rng(seed);

    const intro = pick(rand, DESCRIPTION_INTROS);
    const body = pick(rand, DESCRIPTION_BODIES);
    const cta = pick(rand, CTA_TEMPLATES);
    const handle = `canal.${(strHash(videoYoutubeId) % 10000).toString().padStart(4, '0')}`;

    const sectionCount = rangeInt(rand, 4, 7);
    const sections: string[] = [];
    let mins = 0;
    for (let i = 0; i < sectionCount; i++) {
      const label =
        i === 0
          ? 'Introdução'
          : i === sectionCount - 1
            ? 'Conclusão e próximos passos'
            : pick(rand, [
                'Conceito principal',
                'Demonstração prática',
                'Exemplo do dia a dia',
                'Dicas avançadas',
                'Erros comuns',
                'Estudo de caso',
              ]);
      const stamp = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      sections.push(`${stamp} - ${label}`);
      mins += rangeInt(rand, 90, 240) / 60;
    }

    const description = [
      intro,
      '',
      `Hoje vamos falar sobre: ${videoTitle.toLowerCase()}.`,
      '',
      body,
      '',
      '📌 SUMÁRIO DO VÍDEO:',
      ...sections,
      '',
      '📲 ME SIGA NAS REDES:',
      `- Instagram: @${handle}`,
      `- Twitter: @${handle}`,
      `- TikTok: @${handle}`,
      '',
      '🎁 MATERIAIS GRATUITOS:',
      '- Checklist em PDF: link na bio',
      '- Curso completo com 30% off: cupom CRIADOR2026',
      '',
      `💼 PARCERIAS: contato@${handle}.com.br`,
      '',
      cta,
      '',
      buildHashtags(rand, videoTitle),
    ].join('\n');

    const numTags = rangeInt(rand, 7, 14);
    const tags = pickTags(rand, numTags);

    return {
      description,
      tags,
      // Same content as the small thumb (real YouTube uses the same image at
      // higher resolution); SVG scales to whatever size the renderer asks for.
      thumbnailHdUrl: svgVideoThumbnailDataUrl(videoYoutubeId, videoTitle, videoDurationSec),
      language: 'pt-BR',
      category: pick(rand, CATEGORIES),
      liveBroadcastStatus: rand() > 0.95 ? 'upcoming' : 'none',
    };
  }
}

function pickTags(rand: () => number, count: number): string[] {
  const out = new Set<string>();
  while (out.size < count && out.size < TAG_BANK.length) {
    out.add(pick(rand, TAG_BANK));
  }
  return Array.from(out);
}

function buildHashtags(rand: () => number, title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  const extras = Array.from({ length: rangeInt(rand, 2, 4) }, () => pick(rand, TAG_BANK));
  return [slug, ...extras]
    .filter(Boolean)
    .map((t) => `#${t.replace(/\s+/g, '')}`)
    .join(' ');
}
