import { useEffect, useState } from 'react';
import { Section } from './Section';
import { CredentialField } from './CredentialField';

const MODEL_KEY = 'ai.model';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const MODELS = [
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7 (mais inteligente, mais caro)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recomendado, equilibrado)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (mais rápido, mais barato)' },
];

export function AISection() {
  const [model, setModel] = useState(DEFAULT_MODEL);

  useEffect(() => {
    window.api.settings.get(MODEL_KEY).then((saved) => {
      if (saved) setModel(saved);
    });
  }, []);

  async function handleModelChange(next: string) {
    setModel(next);
    await window.api.settings.set(MODEL_KEY, next);
  }

  return (
    <Section
      title="Inteligência Artificial — Anthropic Claude"
      description="Modelo usado para análises, sugestões de títulos, ângulos e oportunidades. Sua chave nunca sai da sua máquina."
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Modelo
        </label>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <CredentialField
        provider="anthropic"
        label="API Key da Anthropic"
        placeholder="sk-ant-..."
        helpTopic="api-anthropic"
      />

      <div className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
        Próximos provedores (OpenAI, Gemini) chegam em versões futuras.
      </div>
    </Section>
  );
}
