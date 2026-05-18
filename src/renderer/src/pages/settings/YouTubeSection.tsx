import { Section } from './Section';
import { CredentialField } from './CredentialField';

export function YouTubeSection() {
  return (
    <Section
      title="YouTube Data API"
      description="Necessária para monitorar canais, ler estatísticas e baixar metadata de vídeos. Cota gratuita: 10.000 unidades/dia."
    >
      <CredentialField
        provider="youtube"
        label="API Key do Google Cloud (YouTube Data API v3)"
        placeholder="AIza..."
        helpTopic="api-youtube"
      />

      <div className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
        Cota diária restante: <span className="text-zinc-400">consultando... (disponível na Fase 8)</span>
      </div>
    </Section>
  );
}
