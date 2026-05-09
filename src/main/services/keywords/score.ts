import type {
  KeywordResult,
  KeywordScore,
  KeywordSource,
  ScoreComponent,
  ScrapingData,
  KeywordsEverywhereData,
  TrendsData,
} from '@shared/types';

// -----------------------------------------------------------------------------
// Score component definitions
// -----------------------------------------------------------------------------
//
// Each component pulls one signal from one source, normalizes it to 0-100 (where
// 100 = best for the user), and contributes to the final weighted average.
// "invert" components (Concorrência, Saturação) flip the raw value because lower
// raw is better. The default weights below intentionally mirror the formula in
// the planning doc:
//
//   (Volume × Tendência × Frescor) / (Concorrência × Saturação)
//
// Renormalized when sources are missing — see calculateScore.

type ComponentDef<TSourceData> = {
  name: string;
  source: KeywordSource;
  weight: number;
  invert: boolean;
  extract: (data: TSourceData) => number; // returns raw 0-100 (pre-invert)
};

const SCRAPING_COMPONENTS: ComponentDef<ScrapingData>[] = [
  {
    name: 'Concorrência',
    source: 'scraping',
    weight: 0.25,
    invert: true,
    extract: (d) => d.competitionScore,
  },
  {
    name: 'Frescor dos top',
    source: 'scraping',
    weight: 0.15,
    invert: true,
    extract: (d) => normalizeAge(d.averageAgeDays),
  },
  {
    name: 'Saturação',
    source: 'scraping',
    weight: 0.15,
    invert: true,
    extract: (d) => (d.highViewCountInTop / 10) * 100,
  },
];

const KEYWORDS_EVERYWHERE_COMPONENTS: ComponentDef<KeywordsEverywhereData>[] = [
  {
    name: 'Volume',
    source: 'keywords_everywhere',
    weight: 0.25,
    invert: false,
    extract: (d) => normalizeVolume(d.volume),
  },
];

const TRENDS_COMPONENTS: ComponentDef<TrendsData>[] = [
  {
    name: 'Tendência',
    source: 'trends',
    weight: 0.20,
    invert: false,
    extract: (d) => d.trendScore,
  },
];

// -----------------------------------------------------------------------------
// Normalization helpers
// -----------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Volume → 0-100 on a log scale: 100 search/mo → ~0, 100k → ~100. */
function normalizeVolume(volume: number): number {
  if (volume <= 0) return 0;
  const log = Math.log10(volume);
  // log10(100) = 2, log10(100_000) = 5 → map [2, 5] to [0, 100]
  return clamp(((log - 2) / 3) * 100, 0, 100);
}

/** Age → 0-100. 7 days → 0 (very fresh), 365 days → 100 (stale). */
function normalizeAge(ageDays: number): number {
  return clamp(((ageDays - 7) / (365 - 7)) * 100, 0, 100);
}

// -----------------------------------------------------------------------------
// Score calculation with dynamic renormalization
// -----------------------------------------------------------------------------

export function calculateScore(result: KeywordResult): KeywordScore {
  const components: ScoreComponent[] = [];

  if (result.scraping.data) {
    pushComponents(components, SCRAPING_COMPONENTS, result.scraping.data);
  }
  if (result.keywordsEverywhere.data) {
    pushComponents(components, KEYWORDS_EVERYWHERE_COMPONENTS, result.keywordsEverywhere.data);
  }
  if (result.trends.data) {
    pushComponents(components, TRENDS_COMPONENTS, result.trends.data);
  }

  const missingSources: KeywordSource[] = [];
  if (!result.scraping.data) missingSources.push('scraping');
  if (!result.keywordsEverywhere.data) missingSources.push('keywords_everywhere');
  if (!result.trends.data) missingSources.push('trends');

  if (components.length === 0) {
    return {
      value: null,
      components: [],
      explanation: 'Nenhuma fonte respondeu — score indisponível.',
      missingSources,
    };
  }

  // Renormalize weights so they sum to 1 across present components.
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  for (const c of components) {
    c.weight = c.weight / totalWeight;
    c.contribution = c.weight * c.normalizedValue;
  }

  const value = Math.round(components.reduce((sum, c) => sum + c.contribution, 0));

  const explanation =
    missingSources.length === 0
      ? 'Score calculado com as 3 fontes ativas.'
      : `Score renormalizado — ${describeMissing(missingSources)} indisponí${
          missingSources.length > 1 ? 'veis' : 'vel'
        }.`;

  return { value, components, explanation, missingSources };
}

function pushComponents<T>(
  out: ScoreComponent[],
  defs: ComponentDef<T>[],
  data: T
): void {
  for (const def of defs) {
    const raw = def.extract(data);
    const normalized = def.invert ? 100 - raw : raw;
    out.push({
      name: def.name,
      source: def.source,
      rawValue: raw,
      normalizedValue: clamp(normalized, 0, 100),
      weight: def.weight, // renormalized later
      contribution: 0, // computed later
    });
  }
}

function describeMissing(sources: KeywordSource[]): string {
  const labels: Record<KeywordSource, string> = {
    scraping: 'Scraping',
    keywords_everywhere: 'Keywords Everywhere',
    trends: 'Tendências',
  };
  return sources.map((s) => labels[s]).join(', ');
}
