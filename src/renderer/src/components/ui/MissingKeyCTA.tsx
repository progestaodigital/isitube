import { KeyRound, ArrowRight } from 'lucide-react';
import { Card } from './Card';
import { useRouterStore } from '../../stores/router';
import type { CredentialProvider, CredentialStatus } from '@shared/types';

interface MissingKeyCTAProps {
  provider: CredentialProvider;
  status: CredentialStatus | null;
  feature: string;
}

const providerLabels: Record<CredentialProvider, string> = {
  anthropic: 'Anthropic Claude',
  youtube: 'YouTube Data API',
  keywords_everywhere: 'Keywords Everywhere',
};

const providerSettingsHint: Record<CredentialProvider, string> = {
  anthropic: 'Configurações → Inteligência Artificial',
  youtube: 'Configurações → YouTube Data API',
  keywords_everywhere: 'Configurações → Keywords Everywhere',
};

export function MissingKeyCTA({ provider, status, feature }: MissingKeyCTAProps) {
  const navigate = useRouterStore((s) => s.navigate);
  const label = providerLabels[provider];
  const hint = providerSettingsHint[provider];

  const reason =
    status?.status === 'invalid'
      ? `A chave da ${label} foi marcada como inválida.`
      : status?.status === 'untested'
        ? `Sua chave da ${label} ainda não foi testada.`
        : `Você ainda não cadastrou a chave da ${label}.`;

  const action = status?.status === 'invalid' ? 'Revalidar a chave' : 'Configurar chave';

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {feature} precisa da {label}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200/80">
            {reason} Vai em {hint}, cadastra sua chave e clica em "Testar conexão" pra liberar
            essa funcionalidade.
          </p>
          <button
            onClick={() => navigate('settings')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
          >
            {action}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
