import { Crown, ExternalLink } from 'lucide-react';
import { AISection } from './settings/AISection';
import { YouTubeSection } from './settings/YouTubeSection';
import { KeywordsEverywhereSection } from './settings/KeywordsEverywhereSection';
import { TrendsSection } from './settings/TrendsSection';
import { KeywordSourcesSection } from './settings/KeywordSourcesSection';
import { ChannelsSection } from './settings/ChannelsSection';
import { LicenseSection } from './settings/LicenseSection';
import { HealthSection } from './settings/HealthSection';
import { GeneralSection } from './settings/GeneralSection';
import { DataSection } from './settings/DataSection';
import { BackupSection } from './settings/BackupSection';
import { useLicense } from '../hooks/useLicense';

export function SettingsPage() {
  const { info } = useLicense();
  const isIniciante = info?.valid && info.plan === 'iniciante';
  const isPro = info?.valid && info.plan === 'pro';

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {isIniciante
            ? 'Você usa o plano Iniciante — as chaves de IA e YouTube já estão configuradas pra você.'
            : 'Suas chaves de API ficam criptografadas neste computador. Nada sobe pra servidor.'}
        </p>
      </header>

      <LicenseSection />

      {isIniciante && <IniciantePlanBanner subscriptionUrl={info!.subscriptionUrl} />}

      {/* BYOK sections: visíveis só pro Pro (e no estado "carregando licença"
          tratamos como não-iniciante por default — Iniciante explicitamente
          oculta). */}
      {!isIniciante && (
        <>
          <AISection />
          <YouTubeSection />
          <KeywordsEverywhereSection />
        </>
      )}

      <TrendsSection />
      <KeywordSourcesSection />
      <ChannelsSection />
      <GeneralSection />
      <BackupSection />
      <HealthSection />
      <DataSection />

      {isPro && <ProTipBanner />}
    </div>
  );
}

function IniciantePlanBanner({ subscriptionUrl }: { subscriptionUrl: string | null }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          <Crown className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Plano Iniciante — chaves incluídas
            </h3>
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
              No Iniciante, o isiTube usa as chaves Anthropic e YouTube via proxy do isipanel —
              você não precisa criar conta nessas plataformas. O modelo de IA é o Claude Haiku 4.5
              e a cota mensal está visível na seção Licença acima.
            </p>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
            <span className="font-medium">Quer usar suas próprias chaves?</span> O plano Pro libera
            BYOK pra Anthropic (qualquer modelo), YouTube Data API e Keywords Everywhere — sem
            cota imposta.
          </p>
          {subscriptionUrl && (
            <a
              href={subscriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700"
            >
              <Crown className="h-3 w-3" />
              Upgrade pro Pro
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ProTipBanner() {
  return (
    <div className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
      Você está no plano Pro. Use suas próprias chaves nas seções acima — elas ficam encriptadas
      localmente (DPAPI do Windows) e nunca saem da sua máquina.
    </div>
  );
}
