// Minimal type declarations for npm packages that ship without official types.

declare module 'google-trends-api' {
  type GeoOption = { keyword: string; startTime?: Date; endTime?: Date; geo?: string; hl?: string };
  export function interestOverTime(opts: GeoOption): Promise<string>;
  export function relatedQueries(opts: GeoOption): Promise<string>;
  export function relatedTopics(opts: GeoOption): Promise<string>;
  export function dailyTrends(opts: { trendDate?: Date; geo?: string; hl?: string }): Promise<string>;
  const _default: {
    interestOverTime: typeof interestOverTime;
    relatedQueries: typeof relatedQueries;
    relatedTopics: typeof relatedTopics;
    dailyTrends: typeof dailyTrends;
  };
  export default _default;
}
