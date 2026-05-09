// Helpers shared by mock and (future) real channel providers.

export function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function rng(seed: number): () => number {
  // Math.abs guards against accidental negative seeds (e.g. XOR with a
  // constant whose high bit is set). A negative seed makes `% 233280`
  // return a negative remainder in JS and the RNG yields values in (-1, 0].
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function rangeInt(rand: () => number, min: number, max: number): number {
  return Math.floor(min + rand() * (max - min + 1));
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

export function delay(min = 200, max = 600): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const UC_REGEX = /UC[A-Za-z0-9_-]{22}/;

/**
 * Best-effort extraction of a YouTube channel identifier from a URL or raw
 * input. If we can't find a real UC... id, we synthesize a deterministic
 * mock id from the input — good enough for Phase 4 mocks and the user can
 * still cadastrate "@some-handle" or any URL.
 */
export function extractChannelId(urlOrId: string): string {
  const trimmed = urlOrId.trim();

  // Direct UC ID
  const match = trimmed.match(UC_REGEX);
  if (match) return match[0];

  // youtube.com/@handle → use handle
  const handleMatch = trimmed.match(/@([A-Za-z0-9._-]+)/);
  if (handleMatch) return mockIdFrom(`@${handleMatch[1]}`);

  // youtube.com/c/customname or youtube.com/customname
  const cMatch = trimmed.match(/(?:youtube\.com\/c\/|youtube\.com\/)([A-Za-z0-9._-]+)/);
  if (cMatch && cMatch[1] && !cMatch[1].includes('/')) return mockIdFrom(cMatch[1]);

  // Raw text — synthesize
  return mockIdFrom(trimmed);
}

/**
 * Synthesize a stable 24-char "UC..."-shaped id from any input, using only
 * URL-safe characters. Lets the rest of the pipeline treat mocked channels
 * uniformly with real ones.
 */
export function mockIdFrom(input: string): string {
  const hash = strHash(input);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = 'UC';
  let n = hash;
  for (let i = 0; i < 22; i++) {
    n = (n * 9301 + 49297 + i * 137) >>> 0;
    out += alphabet[n % alphabet.length];
  }
  return out;
}

const NICHE_NAMES = [
  'Receitas', 'TecMundo', 'Maker', 'Estúdio', 'Diário', 'Canal',
  'Mundo', 'Aprenda', 'Vida', 'Conexão', 'Mestres', 'Histórias',
];
const NICHE_SUFFIX = [
  'Brasil', 'Top', 'Plus', 'da Vovó', 'do Pedrão', 'Inteligente',
  'em Casa', 'Conectado', '+', 'BR', 'Live', 'do Maker',
];

export function mockChannelTitleFromInput(input: string, rand: () => number): string {
  const trimmed = input.trim();
  // If the input looks like a handle, derive a friendly title from it.
  const handleMatch = trimmed.match(/@([A-Za-z0-9._-]+)/);
  if (handleMatch) {
    return prettifyHandle(handleMatch[1]!);
  }
  if (!trimmed.includes('/') && !trimmed.startsWith('UC') && trimmed.length < 30) {
    return prettifyHandle(trimmed);
  }
  return `${pick(rand, NICHE_NAMES)} ${pick(rand, NICHE_SUFFIX)}`;
}

function prettifyHandle(handle: string): string {
  return handle
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Round avatar SVG with initials over a colored circle. Used for channel
 * avatars (where YouTube real avatars are circular).
 */
export function svgInitialsDataUrl(seed: string, label: string): string {
  const hue = strHash(seed) % 360;
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  const safeInitials = (initials || '??').slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="hsl(${hue},65%,45%)"/><text x="32" y="40" font-family="system-ui,sans-serif" font-size="26" font-weight="600" text-anchor="middle" fill="white">${escapeXml(safeInitials)}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * 16:9 video thumbnail SVG with gradient background, decorative blobs, a play
 * button overlay, the title text at the bottom, and a duration badge in the
 * corner — visually closer to a real YouTube thumbnail. Used for video cards
 * everywhere in the app.
 */
export function svgVideoThumbnailDataUrl(
  seed: string,
  title: string,
  durationSec?: number | null
): string {
  const hash = strHash(seed);
  const hue1 = hash % 360;
  const hue2 = (hash * 7 + 137) % 360;
  const gradId = `g${hash % 99999}`;

  const lines = wrapForThumb(title, 26, 2);
  const duration = formatDurationCompact(durationSec ?? undefined);
  const durBadgeWidth = duration ? duration.length * 7 + 12 : 0;

  const lineYs = lines.length === 1 ? [165] : [152, 168];

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">` +
    `<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue1},65%,38%)"/>` +
    `<stop offset="100%" stop-color="hsl(${hue2},65%,18%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="180" fill="url(#${gradId})"/>` +
    `<circle cx="280" cy="35" r="55" fill="hsla(${hue1},90%,70%,0.18)"/>` +
    `<circle cx="40" cy="155" r="40" fill="hsla(${hue2},90%,70%,0.14)"/>` +
    `<rect x="0" y="120" width="320" height="60" fill="rgba(0,0,0,0.35)"/>` +
    `<circle cx="160" cy="78" r="28" fill="rgba(0,0,0,0.55)"/>` +
    `<polygon points="150,63 150,93 180,78" fill="rgba(255,255,255,0.92)"/>` +
    lines
      .map(
        (line, i) =>
          `<text x="12" y="${lineYs[i]}" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="600" fill="white">${escapeXml(line)}</text>`
      )
      .join('') +
    (duration
      ? `<rect x="${320 - durBadgeWidth - 8}" y="156" width="${durBadgeWidth}" height="18" rx="3" fill="rgba(0,0,0,0.85)"/>` +
        `<text x="${320 - 8 - durBadgeWidth / 2}" y="169" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600" fill="white" text-anchor="middle">${escapeXml(duration)}</text>`
      : '') +
    `</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function wrapForThumb(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) break;
      current = word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // If we ran out of room and there were more words, add an ellipsis.
  const consumed = lines.join(' ').split(/\s+/).length;
  if (consumed < words.length && lines.length === maxLines) {
    const last = lines[maxLines - 1]!;
    lines[maxLines - 1] = last.length > maxChars - 1 ? last.slice(0, maxChars - 1) + '…' : `${last}…`;
  }

  return lines.length > 0 ? lines : [text];
}

function formatDurationCompact(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!
  );
}

const VIDEO_TITLE_TEMPLATES = [
  'Como fazer {topic} em 5 minutos',
  '5 dicas pra dominar {topic}',
  '{topic}: do zero ao avançado',
  'O que aprendi com {topic} em 2026',
  'POV: {topic} no dia a dia',
  'REAGINDO a {topic} viral',
  '{topic} explicado de uma vez',
  'Tudo o que você precisa saber sobre {topic}',
  'Eu tentei {topic} e olha o que aconteceu',
  '{topic} — o guia definitivo',
  'Por que ninguém fala sobre {topic}?',
  '{topic} avançado: técnicas que funcionam',
];

const VIDEO_TOPICS = [
  'edição de vídeo', 'monetização', 'roteiro', 'iluminação',
  'thumbnails', 'algoritmo', 'crescimento orgânico', 'engajamento',
  'sponsors', 'rotina de criador', 'câmera', 'áudio', 'live',
];

export function mockVideoTitle(rand: () => number): string {
  const template = pick(rand, VIDEO_TITLE_TEMPLATES);
  const topic = pick(rand, VIDEO_TOPICS);
  return template.replace('{topic}', topic);
}
