import { useEffect, useState } from 'react';
import { Section } from './Section';
import { cn } from '../../lib/cn';
import type { KeywordSource, KeywordSourceStatuses } from '@shared/types';

const SOURCES: { source: KeywordSource; label: string; description: string }[] = [
  {
    source: 'scraping',
    label: 'Scraping próprio',
    description:
      'Top 10 do YouTube, idade média, saturação e concorrência. Sem chave de API, mas pode ser bloqueado por rate limit.',
  },
  {
    source: 'keywords_everywhere',
    label: 'Keywords Everywhere',
    description:
      'Volume mensal real, CPC e dificuldade SEO. Consome créditos pagos a cada consulta.',
  },
  {
    source: 'trends',
    label: 'Google Trends',
    description: 'Tendência temporal e queries em ascensão. Gratuito, mas com rate limit cuidadoso.',
  },
];

export function KeywordSourcesSection() {
  const [statuses, setStatuses] = useState<KeywordSourceStatuses | null>(null);

  async function refresh() {
    setStatuses(await window.api.keywords.getSourceStatuses());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggle(source: KeywordSource, enabled: boolean) {
    await window.api.keywords.setSourceEnabled(source, enabled);
    await refresh();
  }

  return (
    <Section
      title="Fontes de palavras-chave"
      description="Cada fonte é independente. Quando você desliga uma, o score se renormaliza automaticamente — útil pra economizar créditos ou contornar rate limits."
    >
      {SOURCES.map((s) => {
        const isOn =
          s.source === 'scraping'
            ? (statuses?.scraping.enabled ?? true)
            : s.source === 'keywords_everywhere'
              ? (statuses?.keywordsEverywhere.enabled ?? true)
              : (statuses?.trends.enabled ?? true);
        return (
          <div
            key={s.source}
            className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{s.description}</p>
            </div>
            <Toggle on={isOn} onChange={(on) => toggle(s.source, on)} />
          </div>
        );
      })}
    </Section>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        on ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          on ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}
