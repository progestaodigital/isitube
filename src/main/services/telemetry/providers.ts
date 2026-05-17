// Telemetria leve por provider externo. Mantida em memória — reseta no
// restart do app, suficiente pra alimentar a tela "Status das integrações"
// (10.D) com snapshot do que aconteceu na sessão atual.
//
// Cada provider real (Anthropic, YouTube Data API, ytsr, Trends, KE,
// transcript, autocomplete) chama recordSuccess()/recordFailure() em volta
// das suas operações externas. O serviço de health (IPC `health:list`)
// devolve o array de snapshots pro renderer.
//
// Decisão consciente de NÃO persistir em DB: stats "desde o boot" são mais
// úteis que histórico longo pra "essa integração está saudável agora?";
// histórico longo cobra schema + UI mais pesada e não bate com o caso de
// uso do snapshot screen.

import type { ProviderKey, ProviderSnapshot } from '@shared/types';
export type { ProviderKey, ProviderSnapshot } from '@shared/types';

const store = new Map<ProviderKey, ProviderSnapshot>();

function ensure(key: ProviderKey): ProviderSnapshot {
  let s = store.get(key);
  if (!s) {
    s = {
      key,
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      totalCalls: 0,
      totalFailures: 0,
    };
    store.set(key, s);
  }
  return s;
}

export function recordSuccess(key: ProviderKey): void {
  const s = ensure(key);
  s.lastSuccessAt = new Date().toISOString();
  s.totalCalls += 1;
}

export function recordFailure(key: ProviderKey, err: unknown): void {
  const s = ensure(key);
  const msg = err instanceof Error ? err.message : String(err);
  s.lastErrorAt = new Date().toISOString();
  s.lastErrorMessage = msg.slice(0, 200);
  s.totalCalls += 1;
  s.totalFailures += 1;
}

export function listProviderSnapshots(): ProviderSnapshot[] {
  return Array.from(store.values());
}

/** Test-only — limpa o store entre testes. Não exposto via IPC. */
export function resetTelemetry(): void {
  store.clear();
}
