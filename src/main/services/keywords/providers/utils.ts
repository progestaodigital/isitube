// Deterministic mock helpers. Same input term → same output, so screenshots
// and demos stay consistent. Replace with real I/O in Phase 8.

export function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function rng(seed: number): () => number {
  // Math.abs guards against accidental negative seeds (e.g. XOR with a
  // constant whose high bit is set).
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function rangeInt(rand: () => number, min: number, max: number): number {
  return Math.floor(min + rand() * (max - min + 1));
}

export function rangeFloat(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

export function delay(min = 200, max = 600): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function daysSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}
