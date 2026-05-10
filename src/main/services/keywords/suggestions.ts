import { getPrisma } from '../../db';
import type {
  KeywordSuggestion,
  KeywordSuggestionsPayload,
} from '@shared/types';

// pt-BR + en stopwords. Conservative list — focus on words that appear in
// almost every video title and would dominate the n-gram counts.
const STOPWORDS = new Set([
  // Portuguese
  'a', 'o', 'e', 'é', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'para', 'pra', 'por', 'com', 'sem', 'que', 'qual',
  'quais', 'quem', 'como', 'quando', 'onde', 'mais', 'menos', 'muito', 'pouco',
  'todo', 'toda', 'todos', 'todas', 'este', 'esta', 'esse', 'essa', 'isso', 'aquilo',
  'ele', 'ela', 'eles', 'elas', 'eu', 'tu', 'nós', 'vós', 'meu', 'minha', 'seu',
  'sua', 'meus', 'minhas', 'seus', 'suas', 'não', 'sim', 'ou', 'mas', 'se', 'já',
  'ainda', 'também', 'então', 'depois', 'antes', 'agora', 'foi', 'ser', 'ter', 'estar',
  'fazer', 'fiz', 'faz', 'fez', 'vai', 'vão', 'vem', 'vêm', 'até', 'sobre', 'sob',
  'contra', 'entre', 'durante', 'são', 'tem', 'têm', 'só', 'lá', 'aí', 'aqui', 'ali',
  'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas', 'num', 'numa',
  // English
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as',
  'into', 'like', 'through', 'after', 'before', 'between', 'but', 'and', 'or', 'not',
  'are', 'is', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its',
  'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'just',
  // Years (filter out "2024", "2025", "2026" since they appear in many titles)
  '2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027',
]);

/**
 * Verbos auxiliares e modais que, quando aparecem no INÍCIO de um n-gram,
 * indicam que o n-gram é um fragmento de frase ("am selling", "is going",
 * "tem que"), não uma keyword pesquisável.
 */
const FRAGMENT_STARTERS = new Set([
  // English
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing', 'done',
  'can', 'could', 'will', 'would', 'should', 'must', 'may', 'might',
  'get', 'got', 'getting', 'gets',
  'make', 'makes', 'made', 'making',
  'go', 'goes', 'going', 'went',
  'come', 'comes', 'coming', 'came',
  'want', 'wants', 'wanted', 'need', 'needs', 'needed',
  'feel', 'feels', 'felt', 'think', 'thinks', 'thought',
  'see', 'sees', 'saw', 'know', 'knows', 'knew',
  'just', 'really', 'actually', 'simply', 'finally',
  // pt-BR
  'estou', 'está', 'estão', 'estamos', 'estava', 'estavam',
  'tenho', 'tinha', 'temos', 'tínhamos',
  'fiz', 'faz', 'faço', 'fazem', 'fazendo',
  'vou', 'vamos', 'foi', 'fui',
  'quero', 'queria', 'querem', 'queremos',
  'sei', 'sabia', 'sabemos',
  'posso', 'pode', 'podemos', 'podia',
  'devo', 'deve', 'devemos',
  'gosto', 'gosta', 'gostam',
  'preciso', 'precisa', 'precisam',
]);

/**
 * Palavras genéricas demais pra serem keywords úteis no fim de um n-gram.
 * "wrong thing", "my way" — terminar nessas palavras quase sempre é um
 * fragmento de frase, não uma keyword com intenção de busca.
 */
const GENERIC_TAILS = new Set([
  // English
  'thing', 'things', 'way', 'ways', 'day', 'days', 'time', 'times',
  'people', 'person', 'man', 'woman', 'guy', 'guys', 'kid', 'kids',
  'today', 'tomorrow', 'yesterday', 'now', 'later',
  'good', 'bad', 'best', 'worst', 'better', 'worse',
  'big', 'small', 'right', 'wrong', 'real', 'fake',
  'one', 'two', 'three', 'first', 'last',
  'video', 'videos', 'channel', 'content',
  // pt-BR
  'coisa', 'coisas', 'jeito', 'jeitos', 'forma', 'formas',
  'dia', 'dias', 'tempo', 'tempos', 'hora', 'horas',
  'gente', 'pessoa', 'pessoas', 'cara', 'caras',
  'hoje', 'amanhã', 'ontem',
  'bom', 'ruim', 'melhor', 'pior',
  'grande', 'pequeno', 'certo', 'errado',
  'um', 'dois', 'três', 'primeiro', 'último',
  'vídeo', 'vídeos', 'canal', 'conteúdo',
]);

const SHORTS_MAX_DURATION_SEC = 180;
const DEFAULT_TOP_N = 30;
const DEFAULT_EVERGREEN_LOOKBACK_DAYS = 30;
const DEFAULT_EVERGREEN_MIN_AGE_DAYS = 30;

type DbVideo = {
  id: string;
  title: string;
  tags: string | null;
  viewCount: number;
  durationSec: number | null;
  publishedAt: Date;
  channelId: string;
};

export async function getKeywordSuggestions(): Promise<KeywordSuggestionsPayload> {
  const prisma = getPrisma();

  // 1. Outlier videos (flagged as outlier, any age)
  const outlierVideos = await prisma.video.findMany({
    where: { deletedAt: null, flaggedAsOutlier: true },
    select: {
      id: true,
      title: true,
      tags: true,
      viewCount: true,
      durationSec: true,
      publishedAt: true,
      channelId: true,
    },
    take: 500,
  });

  // 2. Evergreen videos: published >30d ago, with snapshots, viewsPerDay >= 1
  const sinceWindow = new Date(Date.now() - DEFAULT_EVERGREEN_LOOKBACK_DAYS * 86_400_000);
  const maxPublishedAt = new Date(Date.now() - DEFAULT_EVERGREEN_MIN_AGE_DAYS * 86_400_000);
  const candidateEvergreen = await prisma.video.findMany({
    where: {
      deletedAt: null,
      publishedAt: { lte: maxPublishedAt },
    },
    select: {
      id: true,
      title: true,
      tags: true,
      viewCount: true,
      durationSec: true,
      publishedAt: true,
      channelId: true,
      snapshots: {
        where: { deletedAt: null, takenAt: { gte: sinceWindow } },
        orderBy: { takenAt: 'asc' },
        select: { takenAt: true, viewCount: true },
      },
    },
    take: 1000,
  });

  const evergreenVideos: DbVideo[] = [];
  const now = Date.now();
  for (const v of candidateEvergreen) {
    let viewsPerDay = 0;
    if (v.snapshots.length >= 2) {
      const first = v.snapshots[0]!;
      const last = v.snapshots[v.snapshots.length - 1]!;
      const elapsedDays =
        (last.takenAt.getTime() - first.takenAt.getTime()) / 86_400_000;
      if (elapsedDays > 0) {
        viewsPerDay = (last.viewCount - first.viewCount) / elapsedDays;
      }
    } else {
      const ageDays = (now - v.publishedAt.getTime()) / 86_400_000;
      if (ageDays > 0) viewsPerDay = v.viewCount / ageDays;
    }
    if (viewsPerDay >= 1) {
      evergreenVideos.push({
        id: v.id,
        title: v.title,
        tags: v.tags,
        viewCount: v.viewCount,
        durationSec: v.durationSec,
        publishedAt: v.publishedAt,
        channelId: v.channelId,
      });
    }
  }

  return {
    outliers: extractAndRank(outlierVideos),
    evergreen: extractAndRank(evergreenVideos),
  };
}

function extractAndRank(videos: DbVideo[]): KeywordSuggestion[] {
  const map = new Map<
    string,
    {
      term: string;
      source: 'tag' | 'title';
      occurrences: number;
      videoIds: Set<string>;
      totalViews: number;
      shorts: number;
      long: number;
    }
  >();

  for (const v of videos) {
    const isShort =
      v.durationSec !== null && v.durationSec > 0 && v.durationSec <= SHORTS_MAX_DURATION_SEC;

    // Tags first — they're curated by the creator, most reliable signal.
    // Tags can be 1 word ("anthropic") because the creator chose them; we
    // don't aplicar o filtro de fragmento aqui.
    let tags: string[] = [];
    if (v.tags) {
      try {
        const parsed = JSON.parse(v.tags);
        if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === 'string');
      } catch {
        /* ignore bad JSON */
      }
    }
    for (const tag of tags) {
      const normalized = normalize(tag);
      if (!isUsefulTag(normalized)) continue;
      addOccurrence(map, normalized, 'tag', v, isShort);
    }

    // N-grams from title (2-3 words only — single words são quase sempre
    // genéricas/inúteis como keyword pesquisável).
    const titleNgrams = extractNgrams(v.title, [2, 3]);
    for (const gram of titleNgrams) {
      if (!isUsefulNgram(gram)) continue;
      addOccurrence(map, gram, 'title', v, isShort);
    }
  }

  // Convert to array
  const suggestions: KeywordSuggestion[] = Array.from(map.values()).map((s) => ({
    term: s.term,
    source: s.source,
    occurrences: s.occurrences,
    sampleVideoIds: Array.from(s.videoIds).slice(0, 5),
    totalViews: s.totalViews,
    shortsCount: s.shorts,
    longCount: s.long,
  }));

  // Filter:
  //   - tag: precisa estar em ≥ 2 vídeos OU ter views totais ≥ 10k
  //   - title n-gram: precisa estar em ≥ 3 vídeos (mais rigoroso, é ruidoso)
  const filtered = suggestions.filter((s) => {
    if (s.source === 'tag') return s.occurrences >= 2 || s.totalViews >= 10_000;
    return s.occurrences >= 3;
  });

  // Rank: tags primeiro (peso 2x nas occurrences), depois ngrams.
  // Dentro de cada grupo, occurrences > totalViews.
  filtered.sort((a, b) => {
    const aWeight = a.source === 'tag' ? a.occurrences * 2 : a.occurrences;
    const bWeight = b.source === 'tag' ? b.occurrences * 2 : b.occurrences;
    if (bWeight !== aWeight) return bWeight - aWeight;
    return b.totalViews - a.totalViews;
  });

  return filtered.slice(0, DEFAULT_TOP_N);
}

function addOccurrence(
  map: Map<string, ReturnType<typeof newEntry>>,
  term: string,
  source: 'tag' | 'title',
  video: DbVideo,
  isShort: boolean
) {
  let entry = map.get(term);
  if (!entry) {
    entry = newEntry(term, source);
    map.set(term, entry);
  }
  // If a term comes from both a tag AND a title, "tag" takes priority (stronger signal).
  if (source === 'tag' && entry.source === 'title') entry.source = 'tag';
  if (entry.videoIds.has(video.id)) return; // count each video only once per term
  entry.videoIds.add(video.id);
  entry.occurrences += 1;
  entry.totalViews += video.viewCount;
  if (isShort) entry.shorts += 1;
  else entry.long += 1;
}

function newEntry(term: string, source: 'tag' | 'title') {
  return {
    term,
    source,
    occurrences: 0,
    videoIds: new Set<string>(),
    totalViews: 0,
    shorts: 0,
    long: 0,
  };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents for matching, but keep original visible
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tag vinda direto do criador. Mais permissivo: aceita 1-grams e termos
 * compostos. Só rejeita basicão (vazio, número puro, comprimento extremo).
 */
function isUsefulTag(term: string): boolean {
  if (!term || term.length < 3) return false;
  if (term.length > 60) return false;
  if (/^\d+$/.test(term)) return false;
  const words = term.split(/\s+/);
  if (words.every((w) => STOPWORDS.has(w))) return false;
  return true;
}

/**
 * N-gram extraído de título. MUITO mais rigoroso que tag — títulos viram
 * fragmentos de frase com facilidade. Exige multi-palavra, sem starter de
 * fragmento e sem terminação genérica.
 */
function isUsefulNgram(term: string): boolean {
  if (!term || term.length < 4) return false;
  if (term.length > 60) return false;
  const words = term.split(/\s+/);
  if (words.length < 2) return false; // 1-grams sempre fora
  if (words.every((w) => STOPWORDS.has(w))) return false;
  // Primeira palavra é verbo auxiliar / modal / advérbio comum → fragmento
  if (FRAGMENT_STARTERS.has(words[0]!)) return false;
  // Última palavra é genérica → fim de frase, não keyword
  if (GENERIC_TAILS.has(words[words.length - 1]!)) return false;
  return true;
}

function extractNgrams(text: string, sizes: number[]): string[] {
  const tokens = normalize(text)
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  const out: string[] = [];
  for (const n of sizes) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join(' ');
      out.push(gram);
    }
  }
  return out;
}
