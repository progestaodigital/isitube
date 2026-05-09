/**
 * Phase 3 mock — Phase 8 will hit YouTube's autocomplete endpoint
 * (https://suggestqueries-clients6.youtube.com/complete/search?...).
 * For now, return canned variations of the prefix so the UX is testable.
 */
const SUFFIXES = [
  'para iniciantes',
  'em 2026',
  'do zero',
  'avançado',
  'completo',
  'rápido',
  'grátis',
  'tutorial',
  'curso',
  'passo a passo',
];

export async function autocomplete(prefix: string): Promise<string[]> {
  const trimmed = prefix.trim();
  if (trimmed.length < 2) return [];

  // Tiny artificial delay so the UI can show a "loading" if it wants.
  await new Promise((r) => setTimeout(r, 80));

  return SUFFIXES.slice(0, 6).map((s) => `${trimmed} ${s}`);
}
