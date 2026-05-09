import { useEffect, useState } from 'react';
import { Section } from './Section';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

const THRESHOLD_KEY = 'channels.outlier_threshold_percent';
const LOOKBACK_KEY = 'channels.lookback_days';

export function ChannelsSection() {
  const [threshold, setThreshold] = useState('150');
  const [lookback, setLookback] = useState('30');
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      window.api.settings.get(THRESHOLD_KEY),
      window.api.settings.get(LOOKBACK_KEY),
    ]).then(([t, l]) => {
      if (t) setThreshold(t);
      if (l) setLookback(l);
    });
  }, []);

  async function handleSave() {
    const t = Number(threshold);
    const l = Number(lookback);
    if (!Number.isFinite(t) || t < 100) return;
    if (!Number.isFinite(l) || l < 1) return;
    await Promise.all([
      window.api.settings.set(THRESHOLD_KEY, String(t)),
      window.api.settings.set(LOOKBACK_KEY, String(l)),
    ]);
    setSavedAt(new Date().toLocaleTimeString('pt-BR'));
  }

  return (
    <Section
      title="Canais — detecção de vídeos em destaque"
      description="Configurações usadas pelo monitoramento. Mudanças entram em vigor na próxima atualização."
    >
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Threshold do outlier (%)
        </label>
        <Input
          type="number"
          min="100"
          step="10"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Padrão: 150% — vídeos com mais de 1,5x a média do canal viram destaque.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Janela de coleta (dias)
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          value={lookback}
          onChange={(e) => setLookback(e.target.value)}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Padrão: 30 dias — quanto a atualização vai voltar pra trás buscando vídeos novos.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} variant="primary" size="sm">
          Salvar
        </Button>
        {savedAt && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Salvo às {savedAt}
          </span>
        )}
      </div>
    </Section>
  );
}
