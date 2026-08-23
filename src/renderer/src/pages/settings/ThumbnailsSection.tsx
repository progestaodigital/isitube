import { Section } from './Section';
import { CredentialField } from './CredentialField';

export function ThumbnailsSection() {
  return (
    <Section
      title="Geração de thumbnails (Gemini)"
      description="Chave do Google AI (Gemini) usada para gerar thumbnails com IA. É separada da chave do YouTube Data API, mas pode viver no mesmo projeto do Google Cloud."
    >
      <CredentialField
        provider="google_ai"
        label="API Key do Google AI (Gemini)"
        placeholder="AIza..."
        helpTopic="api-gemini"
      />
    </Section>
  );
}
