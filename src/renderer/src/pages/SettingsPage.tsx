import { AISection } from './settings/AISection';
import { YouTubeSection } from './settings/YouTubeSection';
import { KeywordsEverywhereSection } from './settings/KeywordsEverywhereSection';
import { TrendsSection } from './settings/TrendsSection';
import { KeywordSourcesSection } from './settings/KeywordSourcesSection';
import { ChannelsSection } from './settings/ChannelsSection';
import { LicenseSection } from './settings/LicenseSection';
import { GeneralSection } from './settings/GeneralSection';
import { DataSection } from './settings/DataSection';
import { BackupSection } from './settings/BackupSection';

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Suas chaves de API ficam criptografadas neste computador. Nada sobe pra servidor.
        </p>
      </header>

      <LicenseSection />
      <AISection />
      <YouTubeSection />
      <KeywordsEverywhereSection />
      <TrendsSection />
      <KeywordSourcesSection />
      <ChannelsSection />
      <GeneralSection />
      <BackupSection />
      <DataSection />
    </div>
  );
}
