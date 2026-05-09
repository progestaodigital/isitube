import type { TranscriptSegment } from '@shared/types';
import type { FetchedTranscript, TranscriptProvider } from './types';
import {
  delay,
  pick,
  rangeInt,
  rng,
  strHash,
} from '../../channels/providers/utils';

const FRAGMENTS_INTRO = [
  'Olá pessoal, tudo bem com vocês?',
  'Sejam muito bem-vindos a mais um vídeo do canal',
  'Fala galera, tudo certo?',
  'Olá, olá! Mais um vídeo aqui pra vocês',
  'E aí pessoal, tudo bem? Bem-vindos de volta',
];

const FRAGMENTS_BODY = [
  'Hoje a gente vai falar sobre um assunto super importante',
  'Antes de começar, se inscreve aqui no canal',
  'Vamos lá, sem mais delongas',
  'A primeira coisa que você precisa saber é o seguinte',
  'Eu vou te mostrar uma técnica que mudou completamente o meu jogo',
  'Então deixa eu te perguntar uma coisa',
  'Se você já sabe disso, comenta aqui embaixo',
  'Mas e aí, como é que isso funciona na prática?',
  'Na real, a maioria das pessoas não sabe disso',
  'O segredo está em três pontos principais',
  'Olha que interessante isso aqui',
  'Vou te mostrar exatamente como eu fiz',
  'O passo a passo é o seguinte',
  'Primeira coisa: você precisa entender que',
  'Segunda coisa, e talvez mais importante',
  'A terceira parte é onde a maioria erra',
  'Eu mesmo já errei muito nisso, é normal',
  'Mas hoje eu finalmente entendi o que estava errado',
  'A diferença entre quem dá certo e quem não dá é essa',
  'Vou te dar um exemplo prático agora',
  'Imagina a seguinte situação',
  'É exatamente isso que vou explicar agora',
  'Beleza, fechou até aqui?',
  'Então fica a dica',
  'Pra finalizar, eu queria deixar uma reflexão',
  'Outro ponto importante que vale destacar',
  'E olha, isso aqui muda tudo',
  'Quando você entende esse conceito, abre um leque enorme de possibilidades',
];

const FRAGMENTS_OUTRO = [
  'Se isso ajudou, deixa o like',
  'Compartilha com alguém que precisa ver isso',
  'A gente se vê no próximo vídeo',
  'Valeu pessoal, até mais',
  'Forte abraço, falou!',
];

/**
 * Phase 6 mock — generates plausible Brazilian-creator-style transcript
 * segments deterministically from the youtube id. About 14% of videos
 * (hash % 7 === 0) return `unavailable` to demo the empty-state UX.
 */
export class YouTubeMockTranscriptProvider implements TranscriptProvider {
  readonly name = 'youtube-transcript-mock';

  async fetch({
    youtubeId,
    durationSec,
  }: {
    youtubeId: string;
    durationSec: number | null;
  }): Promise<FetchedTranscript> {
    // The real provider runs an invisible BrowserWindow — that takes time.
    // Mock the same UX delay so the loading state is visible.
    await delay(1500, 3500);

    const hash = strHash(youtubeId);

    // Some videos have no native captions.
    if (hash % 7 === 0) {
      return { status: 'unavailable', language: null, segments: [] };
    }

    const seed = hash ^ 0xface;
    const rand = rng(seed);

    // Target total seconds — clamp to a sensible window when we don't know.
    const totalSec = durationSec && durationSec > 30 ? durationSec : 540;

    const segments: TranscriptSegment[] = [];
    let cursor = 0;

    // Intro segments (1-2)
    const introCount = rangeInt(rand, 1, 2);
    for (let i = 0; i < introCount && cursor < totalSec; i++) {
      const text = pick(rand, FRAGMENTS_INTRO);
      segments.push({ start: Math.round(cursor), text });
      cursor += rangeInt(rand, 4, 9);
    }

    // Body until ~totalSec - 15s
    while (cursor < totalSec - 15) {
      const text = pick(rand, FRAGMENTS_BODY);
      segments.push({ start: Math.round(cursor), text });
      cursor += rangeInt(rand, 5, 12);
    }

    // Outro (1-2)
    const outroCount = rangeInt(rand, 1, 2);
    for (let i = 0; i < outroCount; i++) {
      const text = pick(rand, FRAGMENTS_OUTRO);
      segments.push({ start: Math.round(cursor), text });
      cursor += rangeInt(rand, 3, 6);
    }

    return {
      status: 'available',
      language: 'pt-BR',
      segments,
    };
  }
}
