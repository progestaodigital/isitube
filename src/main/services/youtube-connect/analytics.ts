import { getAccessToken } from './index';
import type { YoutubeChannelSummary } from '@shared/types';

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
