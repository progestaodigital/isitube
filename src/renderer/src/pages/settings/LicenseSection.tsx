import { useEffect, useState } from 'react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import type { LicenseInfo } from '@shared/types';

export function LicenseSection() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(force = false) {
    setRefreshing(true);
    try {
      setInfo(await window.api.license.get(force));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refresh(false);
  }, []);

  if (!info) {
    return (
      <Section
        title="Licença"
        description="Sua licença é validada com o IsiPanel."
      >
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

  return (
    <Section
      title="Licença"
      description="Sua licença é validada com o IsiPanel. No MVP roda em modo stub (sempre válida)."
    >
      <div className="flex items-start gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{info.planLabel}</p>
            {info.isStub && (
              <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                Stub
              </span>
            )}
            {info.valid ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                Ativa
              </span>
            ) : (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-red-700 dark:bg-red-950 dark:text-red-400">
                Bloqueada
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Expira em: <span className="font-medium">{expires}</span>
          </p>
          <p className="text-xs text-zinc-500">Última validação: {lastValidated}</p>
          {info.reason && (
            <p className="text-xs text-red-600 dark:text-red-400">{info.reason}</p>
          )}
          {info.isStub && (
            <p className="mt-2 text-xs text-zinc-500">
              Quando o IsiPanel estiver disponível, isso vai validar contra o servidor real
              e refletir o plano que você comprou.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => refresh(true)} disabled={refreshing} variant="secondary" size="sm">
          {refreshing ? 'Validando...' : 'Revalidar agora'}
        </Button>
        <a
          href="https://isipanel.com.br/comprar"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-200 px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-600"
        >
          Comprar / renovar
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Section>
  );
}
