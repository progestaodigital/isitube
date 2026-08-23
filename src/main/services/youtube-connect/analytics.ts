import { getAccessToken } from './index';
import { getCredentialPlainText } from '../credentials';
import type {
  YoutubeChannelSummary,
  YoutubeInsights,
  YoutubeTopVideo,
  YoutubeTrafficSource,
} from '@shared/types';

const BASE = 'https://youtubeanalytics.googleapis.com/v2/reports';

type Report = { headers: string[]; rows: Array<Array<string | number>> };

async function query(params: Record<string, string>): Promise<Report> {
  const token = await getAccessToken();
  const qs = new URLSearchParams({ ids: 'channel==MINE', ...params });
  const res = await fetch(`${BASE}?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    columnHeaders?: Array<{ name: string }>;
    rows?: Array<Array<string | number>>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `YouTube Analytics API erro ${res.status}`);
  }
  return {
    headers: (json.columnHeaders ?? []).map((h) => h.name),
    rows: json.rows ?? [],
  };
}

function rowToMap(
  headers: string[],
  row: Array<string | number> | undefined
): Record<string, number> {
  const m: Record<string, number> = {};
  if (!row) return m;
  headers.forEach((h, i) => {
    const n = Number(row[i]);
    if (Number.isFinite(n)) m[h] = n;
  });
  return m;
}

const CORE = [
  'views',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'subscribersGained',
  'subscribersLost',
  'likes',
  'comments',
  'shares',
];

export async function getChannelSummary(
  startDate: string,
  endDate: string
): Promise<YoutubeChannelSummary> {
  // Núcleo + receita. Se a API recusar a receita (canal não monetizado / escopo),
  // refaz só com o núcleo.
  let core: Record<string, number> = {};
  let estimatedRevenue: number | null = null;
  try {
    const r = await query({ startDate, endDate, metrics: [...CORE, 'estimatedRevenue'].join(',') });
    core = rowToMap(r.headers, r.rows[0]);
    estimatedRevenue = 'estimatedRevenue' in core ? core.estimatedRevenue : null;
  } catch {
    const r = await query({ startDate, endDate, metrics: CORE.join(',') });
    core = rowToMap(r.headers, r.rows[0]);
    estimatedRevenue = null;
  }

  // Impressões/CTR — best-effort (a API pública pode não expor; aí fica só no Studio).
  let impressions: number | null = null;
  let impressionCtr: number | null = null;
  try {
    const r = await query({ startDate, endDate, metrics: 'impressions,impressionClickThroughRate' });
    const m = rowToMap(r.headers, r.rows[0]);
    impressions = 'impressions' in m ? m.impressions : null;
    impressionCtr = 'impressionClickThroughRate' in m ? m.impressionClickThroughRate : null;
  } catch {
    /* não disponível pela API */
  }

  // Série diária (views + tempo de exibição).
  let timeSeries: YoutubeChannelSummary['timeSeries'] = [];
  try {
    const r = await query({
      startDate,
      endDate,
      dimensions: 'day',
      metrics: 'views,estimatedMinutesWatched',
      sort: 'day',
    });
    const di = r.headers.indexOf('day');
    const vi = r.headers.indexOf('views');
    const wi = r.headers.indexOf('estimatedMinutesWatched');
    timeSeries = r.rows.map((row) => ({
      date: String(row[di]),
      views: Number(row[vi] ?? 0),
      estimatedMinutesWatched: Number(row[wi] ?? 0),
    }));
  } catch {
    /* mantém série vazia */
  }

  return {
    period: { startDate, endDate },
    views: core.views ?? 0,
    estimatedMinutesWatched: core.estimatedMinutesWatched ?? 0,
    averageViewDuration: core.averageViewDuration ?? 0,
    averageViewPercentage: core.averageViewPercentage ?? 0,
    subscribersGained: core.subscribersGained ?? 0,
    subscribersLost: core.subscribersLost ?? 0,
    likes: core.likes ?? 0,
    comments: core.comments ?? 0,
    shares: core.shares ?? 0,
    estimatedRevenue,
    impressions,
    impressionCtr,
    timeSeries,
  };
}

// ---------------------------------------------------------------------------
// Insights aprofundados: top vídeos (retenção por vídeo) + fontes de tráfego
// ---------------------------------------------------------------------------

const TRAFFIC_LABELS: Record<string, string> = {
  YT_SEARCH: 'Busca do YouTube',
  RELATED_VIDEO: 'Vídeos sugeridos',
  SUBSCRIBER: 'Feed / inscritos',
  YT_CHANNEL: 'Página do canal',
  PLAYLIST: 'Playlists',
  YT_PLAYLIST_PAGE: 'Página de playlist',
  EXT_URL: 'Sites externos',
  NOTIFICATION: 'Notificações',
  SHORTS: 'Feed de Shorts',
  END_SCREEN: 'Telas finais',
  ANNOTATION: 'Cards / anotações',
  CAMPAIGN_CARD: 'Cards',
  NO_LINK_EMBEDDED: 'Players incorporados',
  NO_LINK_OTHER: 'Outros (direto)',
  HASHTAGS: 'Hashtags',
  YT_OTHER_PAGE: 'Outras páginas do YouTube',
  ADVERTISING: 'Anúncios',
  PROMOTED: 'Promovido',
};

async function resolveVideoMeta(
  ids: string[]
): Promise<Map<string, { title: string; thumbnailUrl: string | null }>> {
  const map = new Map<string, { title: string; thumbnailUrl: string | null }>();
  if (ids.length === 0) return map;
  // Título/thumb vêm da YouTube Data API (chave BYOK) — o Analytics só dá o id.
  const key = await getCredentialPlainText('youtube');
  if (!key) return map;
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(
      ','
    )}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return map;
    const json = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet?: { title?: string; thumbnails?: Record<string, { url: string }> };
      }>;
    };
    for (const it of json.items ?? []) {
      const thumb =
        it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? null;
      map.set(it.id, { title: it.snippet?.title ?? '', thumbnailUrl: thumb });
    }
  } catch {
    /* best-effort — sem chave/erro, fica só o id */
  }
  return map;
}

export async function getTopVideos(
  startDate: string,
  endDate: string,
  max = 10
): Promise<YoutubeTopVideo[]> {
  const r = await query({
    startDate,
    endDate,
    dimensions: 'video',
    metrics:
      'views,estimatedMinutesWatched,averageViewPercentage,averageViewDuration,subscribersGained',
    sort: '-views',
    maxResults: String(max),
  });
  const idx = (name: string) => r.headers.indexOf(name);
  const vi = idx('video');
  const viewI = idx('views');
  const wI = idx('estimatedMinutesWatched');
  const apI = idx('averageViewPercentage');
  const adI = idx('averageViewDuration');
  const sgI = idx('subscribersGained');

  const base = r.rows.map((row) => ({
    videoId: String(row[vi]),
    views: Number(row[viewI] ?? 0),
    estimatedMinutesWatched: Number(row[wI] ?? 0),
    averageViewPercentage: Number(row[apI] ?? 0),
    averageViewDuration: Number(row[adI] ?? 0),
    subscribersGained: Number(row[sgI] ?? 0),
  }));

  const meta = await resolveVideoMeta(base.map((b) => b.videoId));
  return base.map((b) => ({
    ...b,
    title: meta.get(b.videoId)?.title ?? null,
    thumbnailUrl: meta.get(b.videoId)?.thumbnailUrl ?? null,
  }));
}

export async function getTrafficSources(
  startDate: string,
  endDate: string
): Promise<YoutubeTrafficSource[]> {
  const r = await query({
    startDate,
    endDate,
    dimensions: 'insightTrafficSourceType',
    metrics: 'views,estimatedMinutesWatched',
    sort: '-views',
  });
  const si = r.headers.indexOf('insightTrafficSourceType');
  const vi = r.headers.indexOf('views');
  const wi = r.headers.indexOf('estimatedMinutesWatched');
  return r.rows.map((row) => {
    const source = String(row[si]);
    return {
      source,
      label: TRAFFIC_LABELS[source] ?? source,
      views: Number(row[vi] ?? 0),
      estimatedMinutesWatched: Number(row[wi] ?? 0),
    };
  });
}

export async function getInsights(startDate: string, endDate: string): Promise<YoutubeInsights> {
  const [topVideos, trafficSources] = await Promise.all([
    getTopVideos(startDate, endDate, 10).catch(() => [] as YoutubeTopVideo[]),
    getTrafficSources(startDate, endDate).catch(() => [] as YoutubeTrafficSource[]),
  ]);
  return { topVideos, trafficSources };
}
