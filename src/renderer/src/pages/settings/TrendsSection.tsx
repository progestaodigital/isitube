import { useState } from 'react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';

export function TrendsSection() {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function handleTest() {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await window.api.keywords.testTrends();
      setFeedback({ kind: result.success ? 'ok' : 'err', text: result.message });
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Falha desconhecida.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Google Trends"
      description="Tendência temporal e sazonalidade. Sem chave necessária — usado via API não oficial com rate limit cuidadoso."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleTest} disabled={busy} variant="secondary" size="sm">
          {busy ? 'Testando...' : 'Testar conectividade'}
        </Button>
        {feedback && (
          <span
            className={
              feedback.kind === 'ok'
                ? 'text-xs text-emerald-600 dark:text-emerald-400'
                : 'text-xs text-red-600 dark:text-red-400'
            }
          >
            {feedback.text}
          </span>
        )}
      </div>
    </Section>
  );
}
