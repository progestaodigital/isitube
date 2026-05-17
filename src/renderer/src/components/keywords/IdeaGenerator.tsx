// Gerador de ideias de palavra-chave reusável. Dois modos:
//   - 'free' (default): autocomplete YouTube + Trends. Sem IA, sem custo.
//   - 'ai': AIService.generateKeywordIdeas (Anthropic via proxy iniciante ou
//     BYOK pro). Mostra MissingKeyCTA quando Pro sem chave Anthropic.
//
// Originalmente vivia inline como AIDemo dentro de HomePage. Extraído pra
// também aparecer na página Keywords (acima da busca de volume) sem duplicar.

import { useState } from 'react';
import { Wand2, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MissingKeyCTA } from '../ui/MissingKeyCTA';
import { isCredentialReady, useCredentialStatus } from '../../hooks/useCredentialStatus';
import { cn } from '../../lib/cn';
import type { FreeKeywordIdeasResult, KeywordIdeasResult } from '@shared/types';

type Mode = 'free' | 'ai';

interface IdeaGeneratorProps {
  /** Optional callback to surface clicked ideas (e.g., trigger a search). */
  onPickIdea?: (term: string) => void;
}

export function IdeaGenerator({ onPickIdea }: IdeaGeneratorProps = {}) {
  const anthropic = useCredentialStatus('anthropic');
  const aiReady = isCredentialReady(anthropic);

  const [mode, setMode] = useState<Mode>('free');
  const [seed, setSeed] = useState('receitas fitness');
  const [aiResult, setAiResult] = useState<KeywordIdeasResult | null>(null);
  const [freeResult, setFreeResult] = useState<FreeKeywordIdeasResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!seed.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'ai') {
        const res = await window.api.ai.generateKeywordIdeas(seed.trim());
        setAiResult(res);
      } else {
        const res = await window.api.keywords.generateFreeIdeas(seed.trim());
        setFreeResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha desconhecida');
    } finally {
      setBusy(false);
    }
  }

  // Plano Iniciante usa proxy Anthropic — não precisa de chave do usuário.
  // O MissingKeyCTA só vale pro Pro (BYOK) que não cadastrou a Anthropic.
  const blockedByMissingKey = mode === 'ai' && !aiReady && anthropic.status !== 'untested';

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
          <Wand2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Gerar ideias de palavra-chave</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {mode === 'ai'
              ? '5 ideias com justificativa, dificuldade e volume — geradas pelo Claude.'
              : 'Até 25 sugestões instantâneas do autocomplete do YouTube + queries em ascensão do Trends. Sem IA, sem custo.'}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {blockedByMissingKey ? (
        <div className="mt-4">
          <MissingKeyCTA
            provider="anthropic"
            status={anthropic}
            feature="Modo IA do gerador de ideias"
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
              placeholder="Tema (ex: receitas fitness, marcenaria, finanças pessoais)"
              className="flex-1"
              disabled={busy}
            />
            <Button onClick={handleGenerate} disabled={busy || !seed.trim()} variant="primary">
              {busy ? 'Gerando...' : mode === 'ai' ? 'Gerar 5 ideias' : 'Buscar ideias'}
            </Button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {mode === 'ai' && aiResult && <AIResults result={aiResult} onPickIdea={onPickIdea} />}
          {mode === 'free' && freeResult && (
            <FreeResults result={freeResult} onPickIdea={onPickIdea} />
          )}
        </>
      )}
    </Card>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex shrink-0 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
      <button
        onClick={() => onChange('free')}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
          mode === 'free'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        )}
      >
        Sem IA
      </button>
      <button
        onClick={() => onChange('ai')}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
          mode === 'ai'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        )}
      >
        <Wand2 className="h-3 w-3" />
        Com IA
      </button>
    </div>
  );
}

function FreeResults({
  result,
  onPickIdea,
}: {
  result: FreeKeywordIdeasResult;
  onPickIdea?: (term: string) => void;
}) {
  if (result.ideas.length === 0) {
    return (
      <p className="mt-4 text-xs text-zinc-500">
        Nenhuma sugestão encontrada para esse termo. Tente algo mais comum ou específico.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {result.ideas.map((idea, i) => {
          const isClickable = !!onPickIdea;
          const baseClass = cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs',
            idea.source === 'autocomplete'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
              : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
            isClickable && 'cursor-pointer hover:opacity-80'
          );
          const content = (
            <>
              {idea.source === 'trends' && <TrendingUp className="h-3 w-3" />}
              {idea.term}
            </>
          );
          return isClickable ? (
            <button
              key={`${idea.term}-${i}`}
              type="button"
              onClick={() => onPickIdea!(idea.term)}
              title="Verificar volume de busca"
              className={baseClass}
            >
              {content}
            </button>
          ) : (
            <span key={`${idea.term}-${i}`} className={baseClass}>
              {content}
            </span>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-500">
        {result.ideas.length} sugestões em {result.meta.durationMs}ms · fontes:{' '}
        {result.meta.sources.length > 0
          ? result.meta.sources
              .map((s) => (s === 'autocomplete' ? 'autocomplete' : 'tendências'))
              .join(' + ')
          : 'nenhuma'}
      </p>
    </div>
  );
}

function AIResults({
  result,
  onPickIdea,
}: {
  result: KeywordIdeasResult;
  onPickIdea?: (term: string) => void;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-2">
        {result.ideas.map((idea, i) => (
          <div
            key={i}
            role={onPickIdea ? 'button' : undefined}
            tabIndex={onPickIdea ? 0 : undefined}
            title={onPickIdea ? 'Verificar volume de busca' : undefined}
            className={cn(
              'rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30',
              onPickIdea && 'cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600'
            )}
            onClick={() => onPickIdea?.(idea.term)}
            onKeyDown={(e) => {
              if (onPickIdea && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onPickIdea(idea.term);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{idea.term}</p>
              <div className="flex shrink-0 gap-1.5">
                <DifficultyBadge level={idea.estimatedDifficulty} />
                <VolumeBadge level={idea.estimatedVolume} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              {idea.rationale}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">
        Gerado em {result.meta.durationMs}ms via provider{' '}
        <span className="font-mono">{result.meta.provider}</span>
        {result.meta.model ? ` (${result.meta.model})` : ''}.
      </p>
    </div>
  );
}

function DifficultyBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const classes = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  }[level];
  const label = { low: 'Dif. baixa', medium: 'Dif. média', high: 'Dif. alta' }[level];
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', classes)}>
      {label}
    </span>
  );
}

function VolumeBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const classes = {
    low: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    high: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  }[level];
  const label = { low: 'Vol. baixo', medium: 'Vol. médio', high: 'Vol. alto' }[level];
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', classes)}>
      {label}
    </span>
  );
}
