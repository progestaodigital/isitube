// Snapshot de saúde dos providers externos. Lê a telemetria in-memory do
// main process (resetada a cada boot) via `window.api.health.list()`.
//
// Escopo deliberadamente enxuto (opção 1 da Fase 10.D): só estado atual.
// Sem latência média, sem histórico de 24h, sem alertas push — adiciona
// quando aparecer caso de uso.

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import type { ProviderKey, ProviderSnapshot } from '@shared/types';

// Ordem fixa pra UI ficar estável independente da ordem que os providers
// foram chamados pela 1ª vez.
const DISPLAY_ORDER: ProviderKey[] = [
  'anthropic',
  'youtube-data-api',
  'youtube-scraping',
  'youtube-transcript',
  'youtube-autocomplete',
  'trends',
  'keywords-everywhere',
  'isipanel-validate',
  'github',
];

const LABELS: Record<ProviderKey, { name: string; description: string }> = {
  anthropic: {
    name: 'Claude (Anthropic)',
    description: 'IA — geração de ideias e análises',
  },
  'youtube-data-api': {
    name: 'YouTube Data API',
    description: 'Canais, vídeos, métricas oficiais',
  },
  'youtube-scraping': {
    name: 'YouTube SERP (scraping)',
    description: 'Concorrência no top 10 das buscas',
  },
  'youtube-transcript': {
    name: 'Transcrições do YouTube',
    description: 'Legendas públicas dos vídeos',
  },
  'youtube-autocomplete': {
    name: 'YouTube Autocomplete',
    description: 'Sugestões do search box do YouTube',
  },
  trends: {
    name: 'Google Trends',
    description: 'Volume relativo e queries em ascensão',
  },
  'keywords-everywhere': {
    name: 'Keywords Everywhere',
    description: 'Volume absoluto, CPC, dificuldade (Pro BYOK)',
  },
  'isipanel-validate': {
    name: 'isipanel — Validação de licença',
    description: 'Painel que valida tua licença',
  },
  github: {
    name: 'GitHub',
    description: 'Backup e atualizações do app',
  },
};

export function HealthSection() {
  const [snapshots, setSnapshots] = useState<ProviderSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshots(await window.api.health.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tick a cada 30s pra que os "há X minutos" se atualizem sozinhos.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const byKey = new Map(snapshots.map((s) => [s.key, s]));

  return (
    <Section
      title="Status das integrações"
      description="Snapshot de cada API externa desde que você abriu o app. Reseta no restart. Útil pra entender se algo está degradado antes de abrir um chamado."
    >
      <div className="flex justify-end">
        <Button onClick={refresh} disabled={loading} variant="secondary" size="sm">
          <RefreshCw className={cn('mr-1 h-3.5 w-3.5', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </div>

      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {DISPLAY_ORDER.map((key) => (
          <HealthRow key={key} providerKey={key} snapshot={byKey.get(key) ?? null} now={now} />
        ))}
      </div>
    </Section>
  );
}

interface HealthRowProps {
  providerKey: ProviderKey;
  snapshot: ProviderSnapshot | null;
  now: number;
}

function HealthRow({ providerKey, snapshot, now }: HealthRowProps) {
  const label = LABELS[providerKey];
  const status = deriveStatus(snapshot);

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label.name}</p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">{label.description}</p>
        {snapshot && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-500">
            {snapshot.lastSuccessAt && (
              <span>
                Última OK:{' '}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {formatRelative(snapshot.lastSuccessAt, now)}
                </span>
              </span>
            )}
            {snapshot.lastErrorAt && (
              <span title={snapshot.lastErrorMessage ?? undefined}>
                Última falha:{' '}
                <span className="text-zinc-700 dark:text-zinc-300">
                  {formatRelative(snapshot.lastErrorAt, now)}
                </span>
              </span>
            )}
            <span>
              {snapshot.totalCalls} chamada{snapshot.totalCalls === 1 ? '' : 's'}
              {snapshot.totalFailures > 0 && (
                <> · <span className="text-red-600 dark:text-red-400">{snapshot.totalFailures} falha{snapshot.totalFailures === 1 ? '' : 's'}</span></>
              )}
            </span>
          </div>
        )}
        {snapshot?.lastErrorMessage && status === 'error' && (
          <p className="mt-1 line-clamp-2 text-[11px] text-red-600 dark:text-red-400">
            {snapshot.lastErrorMessage}
          </p>
        )}
        {!snapshot && (
          <p className="mt-1 text-[11px] text-zinc-400">
            Nenhuma chamada registrada nesta sessão.
          </p>
        )}
      </div>
    </div>
  );
}

type HealthStatus = 'ok' | 'error' | 'idle';

function deriveStatus(snapshot: ProviderSnapshot | null): HealthStatus {
  if (!snapshot || snapshot.totalCalls === 0) return 'idle';
  if (!snapshot.lastSuccessAt) return 'error';
  if (!snapshot.lastErrorAt) return 'ok';
  // Se a última chamada foi um erro (depois do último sucesso), trata como erro.
  return new Date(snapshot.lastErrorAt) > new Date(snapshot.lastSuccessAt) ? 'error' : 'ok';
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === 'ok') {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />;
  }
  if (status === 'error') {
    return <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />;
  }
  return <MinusCircle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-400" />;
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const config = {
    ok: { label: 'OK', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' },
    error: { label: 'ERRO', tone: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
    idle: { label: 'OCIOSO', tone: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  }[status];

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        config.tone
      )}
    >
      {config.label}
    </span>
  );
}

function formatRelative(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 30) return 'agora';
  if (diffSec < 60) return `${diffSec}s atrás`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min atrás`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h atrás`;
  // No reset diário (a tela reseta no boot do app), >24h é raro mas pode acontecer
  // se o usuário deixar o app aberto por dias. Mostra data legível.
  return new Date(iso).toLocaleString('pt-BR');
}

// Mantém o ícone Activity importado pro caso futuro de header decorativo.
void Activity;
