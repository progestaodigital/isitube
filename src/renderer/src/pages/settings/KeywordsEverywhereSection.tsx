import { Section } from './Section';
import { CredentialField } from './CredentialField';

export function KeywordsEverywhereSection() {
  return (
    <Section
      title="Keywords Everywhere"
      description="Volume mensal absoluto de busca, CPC e dificuldade SEO. Modelo pay-as-you-go (~US$10 por 100 mil créditos)."
    >
      <CredentialField
        provider="keywords_everywhere"
        label="API Key do Keywords Everywhere"
        placeholder="..."
        helpUrl="https://keywordseverywhere.com/manage-api-key.html"
      />

      <div className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
        Créditos restantes: <span className="text-zinc-400">consultando... (disponível na Fase 8)</span>
      </div>
    </Section>
  );
}
