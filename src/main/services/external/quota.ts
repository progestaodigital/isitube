// Per-process quota snapshot store + fetch wrapper that records quota headers
// emitted by the isipanel proxy on every response.
//
// The proxy returns these headers on success (200) and on quota-exceeded
// (429) responses:
//   X-Quota-Used       integer — units/cents consumed in the current period
//   X-Quota-Remaining  integer — units/cents left in the current period
//   X-Quota-Period     string  — 'YYYY-MM' (Anthropic monthly) or 'YYYY-MM-DD' (YouTube daily)
//   X-Quota-Cost       integer — units this specific call deducted (YouTube only)
//
// We keep the latest snapshot per API in memory and expose it via IPC so the
// renderer can render a live progress bar in the License section without
// polling a separate endpoint.
//
// In `direct` mode no quota headers are emitted, so `recordQuotaFromHeaders`
// is a safe no-op when called against a non-proxy response.

import type { QuotaApi, QuotaSnapshot } from '@shared/types';

const snapshots = new Map<QuotaApi, QuotaSnapshot>();

export function recordQuotaFromHeaders(api: QuotaApi, headers: Headers): void {
  const used = headers.get('x-quota-used');
  const remaining = headers.get('x-quota-remaining');
  const period = headers.get('x-quota-period');
  if (used === null || remaining === null || period === null) {
    return; // not a proxy response (direct mode, or non-quota error path)
  }

  const usedInt = Number.parseInt(used, 10);
  const remainingInt = Number.parseInt(remaining, 10);
  if (!Number.isFinite(usedInt) || !Number.isFinite(remainingInt)) return;

  const costRaw = headers.get('x-quota-cost');
  const cost = costRaw === null ? null : Number.parseInt(costRaw, 10);

  snapshots.set(api, {
    api,
    used: usedInt,
    remaining: remainingInt,
    period,
    lastCallCost: cost !== null && Number.isFinite(cost) ? cost : null,
    recordedAt: new Date().toISOString(),
  });
}

export function getQuotaSnapshot(api: QuotaApi): QuotaSnapshot | null {
  return snapshots.get(api) ?? null;
}

export function listQuotaSnapshots(): QuotaSnapshot[] {
  return Array.from(snapshots.values());
}

/**
 * Drop-in replacement for `fetch` that also captures quota headers from the
 * response (if any). Always returns the original response unchanged.
 *
 * Use this in `proxy` mode. In `direct` mode it still works — the upstream
 * provider just doesn't emit X-Quota-* headers, so the store is left alone.
 */
export async function fetchWithQuotaTracking(
  api: QuotaApi,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);
  recordQuotaFromHeaders(api, res.headers);
  return res;
}

/**
 * Build a custom `fetch` implementation that records quota headers and
 * delegates to the global fetch. Pass this to AI SDK constructors that accept
 * a `fetch` option (e.g. `createAnthropic({ fetch: ... })`) so streaming
 * responses also feed the quota store.
 */
export function createTrackingFetch(api: QuotaApi): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, init);
    recordQuotaFromHeaders(api, res.headers);
    return res;
  };
}

/** Test-only — clears the in-memory store. Not exposed via IPC. */
export function resetQuotaStore(): void {
  snapshots.clear();
}
