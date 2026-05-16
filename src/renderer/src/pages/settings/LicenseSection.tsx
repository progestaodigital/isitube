import { useState } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink, KeyRound } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { PlanBadge } from '../../components/license/PlanBadge';
import { useLicense } from '../../hooks/useLicense';
import { useQuota } from '../../hooks/useQuota';
import type { QuotaSnapshot } from '@shared/types';

export function LicenseSection() {
  const { info, loading, submitting, refresh, clear } = useLicense();
  const quota = useQuota();
  const [confirmingClear, setConfirmingClear] = useState(false);

  if (loading || !info) {
    return (
      <Section title="Licença" description="Sua licença é validada com o painel isipanel.">
        <div className="flex items-start gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </Section>
    );
  }

  const Icon = info.valid ? CheckCircle2 : AlertCircle;
  const iconColor = info.valid ? 'text-emerald-500' : 'text-red-500';
  const expires = info.expiresAt ? new Date(info.expiresAt).toLocaleDateString('pt-BR') : '—';
  const lastValidated = info.lastValidatedAt
    ? new Date(info.lastValidatedAt).toLocaleString('pt-BR')
    : '—';
  const isIniciante = info.valid && info.plan === 'iniciante';

  return (
    <Section
      title="Licença"
      description="Sua licença é validada com o painel isipanel. Cota usada do plano Iniciante aparece em tempo real abaixo."
    >
      <div className="flex items-start gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{info.planLabel}</p>
            <PlanBadge info={info} />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Expira em: <span className="font-medium">{expires}</span>
          </p>
          <p className="text-xs text-zinc-500">Última validação: {lastValidated}</p>
          {info.reason && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{info.reason}</p>
          )}
        </div>
      </div>

      {isIniciante && (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Cota do plano Iniciante</h4>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              {quota.loading ? 'Carregando…' : 'Atualiza em ~30s'}
            </span>
          </div>
          <QuotaBar
            api="anthropic"
            label="Inteligência Artificial (Anthropic Claude Haiku)"
            snapshot={quota.anthropic}
            formatLabel={formatCentsBRL}
            periodLabel="Mês atual"
            emptyHint="Use o gerador de ideias na página Palavras-chave pra começar a consumir."
          />
          <QuotaBar
            api="youtube"
            label="YouTube Data API"
            snapshot={quota.youtube}
            formatLabel={formatUnits}
            periodLabel="Hoje (UTC)"
            emptyHint="Cadastre um canal pra começar a consumir."
          />
          <p className="text-[11px] text-zinc-500">
            Quando uma cota acabar, as features que dependem dela são pausadas até o próximo
            período. Pra remover limites, faça upgrade pro Pro.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => refresh(true)} disabled={submitting} variant="secondary" size="sm">
          {submitting ? 'Validando…' : 'Revalidar agora'}
        </Button>

        {info.valid && !confirmingClear && (
          <Button
            onClick={() => setConfirmingClear(true)}
            disabled={submitting}
            variant="ghost"
            size="sm"
          >
            <KeyRound className="mr-1 h-3.5 w-3.5" />
            Trocar chave
          </Button>
        )}
        {info.valid && confirmingClear && (
          <>
            <Button
              onClick={async () => {
                await clear();
                setConfirmingClear(false);
              }}
              disabled={submitting}
              variant="danger"
              size="sm"
            >
              Sim, remover
            </Button>
            <Button
              onClick={() => setConfirmingClear(false)}
              disabled={submitting}
              variant="ghost"
              size="sm"
            >
              Cancelar
            </Button>
          </>
        )}

        {info.subscriptionUrl && (
          <a
            href={info.subscriptionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-200 px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
          >
            {info.plan === 'iniciante' ? 'Upgrade pro Pro' : 'Renovar'}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {info.supportUrl && (
          <a
            href={info.supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Suporte
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </Section>
  );
}

// ============================================================================
// Helpers
// ============================================================================

interface QuotaBarProps {
  api: 'anthropic' | 'youtube';
  label: string;
  snapshot: QuotaSnapshot | null;
  formatLabel: (value: number) => string;
  periodLabel: string;
  emptyHint: string;
}

function QuotaBar({ label, snapshot, formatLabel, periodLabel, emptyHint }: QuotaBarProps) {
  if (!snapshot) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
          <span className="text-zinc-500">{periodLabel}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <p className="text-[10px] text-zinc-500">{emptyHint}</p>
      </div>
    );
  }

  const total = snapshot.used + snapshot.remaining;
  const pct = total > 0 ? Math.min(100, Math.round((snapshot.used / total) * 100)) : 0;
  const tone =
    pct >= 90
      ? 'bg-red-500'
      : pct >= 70
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        <span className="text-zinc-500">{periodLabel}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
        <span>
          {formatLabel(snapshot.used)} <span className="text-zinc-400">de</span>{' '}
          {formatLabel(total)} usados ({pct}%)
        </span>
        <span className="font-mono text-zinc-500">{snapshot.period}</span>
      </div>
    </div>
  );
}

function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function formatUnits(units: number): string {
  return units.toLocaleString('pt-BR') + ' u';
}
