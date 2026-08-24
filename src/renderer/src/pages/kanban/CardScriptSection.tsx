import { useEffect, useState } from 'react';
import { Zap, FileText, Loader2, Check } from 'lucide-react';
import type { CardHooksResult, HookVariant, KanbanCard } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../stores/toast';
import { cn } from '../../lib/cn';

interface CardScriptSectionProps {
  card: KanbanCard;
  onChanged: () => Promise<void> | void;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function CardScriptSection({ card, onChanged }: CardScriptSectionProps) {
  const showToast = useToastStore((s) => s.show);
  const [hooks, setHooks] = useState<CardHooksResult | null>(null);
  const [busyHooks, setBusyHooks] = useState(false);
  const [busyScript, setBusyScript] = useState(false);
  const [targetLength, setTargetLength] = useState(8);
  const [script, setScript] = useState(card.script ?? '');

  useEffect(() => {
    setScript(card.script ?? '');
  }, [card.id, card.updatedAt]);

  async function persist(patch: Parameters<typeof window.api.kanban.updateCard>[1]) {
    try {
      await window.api.kanban.updateCard(card.id, patch);
      await onChanged();
    } catch (err) {
      showToast({ kind: 'error', title: 'Falha ao salvar', description: msg(err) });
    }
  }

  async function generateHooks() {
    setBusyHooks(true);
    try {
      const res = await window.api.ai.generateCardHooks(card.id);
      setHooks(res);
    } catch (err) {
      showToast({ kind: 'error', title: 'Falha ao gerar ganchos', description: msg(err) });
    } finally {
      setBusyHooks(false);
    }
  }

  async function generateScript() {
    setBusyScript(true);
    try {
      await window.api.ai.generateCardScript(card.id, targetLength);
      await onChanged();
      showToast({ kind: 'success', title: 'Roteiro criado', description: 'O campo foi preenchido.' });
    } catch (err) {
      showToast({ kind: 'error', title: 'Falha ao criar roteiro', description: msg(err) });
    } finally {
      setBusyScript(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Etapa 1: Gancho */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium">1. Gancho</span>
          <Button onClick={generateHooks} disabled={busyHooks} variant="secondary" size="sm">
            {busyHooks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {busyHooks ? 'Gerando…' : hooks ? 'Gerar outros' : 'Gerar ganchos'}
          </Button>
        </div>

        {card.hook && (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs dark:border-emerald-800 dark:bg-emerald-950/40">
            <p className="mb-0.5 flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Gancho escolhido
            </p>
            <p className="text-zinc-700 dark:text-zinc-300">{card.hook}</p>
          </div>
        )}

        {hooks && (
          <div className="space-y-2">
            {hooks.recommendation && (
              <p className="text-[11px] italic text-zinc-500">
                Recomendação: {hooks.recommendation}
              </p>
            )}
            {hooks.variants.map((v) => (
              <HookCard
                key={v.style}
                variant={v}
                chosen={card.hook === v.script}
                onUse={() => persist({ hook: v.script })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Etapa 2: Roteiro */}
      <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-xs font-medium">2. Roteiro</span>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <input
              type="number"
              min={2}
              max={60}
              value={targetLength}
              onChange={(e) => setTargetLength(Number(e.target.value) || 8)}
              className="w-14 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            min
          </div>
          <Button
            onClick={generateScript}
            disabled={busyScript || !card.hook}
            variant="secondary"
            size="sm"
            title={!card.hook ? 'Escolha um gancho primeiro' : 'Gerar o roteiro a partir do gancho'}
          >
            {busyScript ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {busyScript ? 'Criando…' : card.script ? 'Recriar roteiro' : 'Criar roteiro'}
          </Button>
        </div>
        {!card.hook && (
          <p className="text-[11px] text-zinc-500">
            Escolha um gancho acima pra liberar a criação do roteiro.
          </p>
        )}

        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          onBlur={() => {
            if ((script || null) !== (card.script || null)) {
              persist({ script: script || null });
            }
          }}
          rows={12}
          placeholder="O roteiro gerado aparece aqui (editável). Ou escreva o seu."
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
    </div>
  );
}

const RISK_TONE: Record<HookVariant['dropOffRisk'], string> = {
  baixo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  medio: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  alto: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
};

function HookCard({
  variant,
  chosen,
  onUse,
}: {
  variant: HookVariant;
  chosen: boolean;
  onUse: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-2.5 text-xs',
        chosen
          ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
          : 'border-zinc-200 dark:border-zinc-800'
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{variant.style}</span>
        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium', RISK_TONE[variant.dropOffRisk])}>
          risco {variant.dropOffRisk}
        </span>
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {variant.trafficSource}
        </span>
      </div>
      <p className="text-zinc-700 dark:text-zinc-300">{variant.script}</p>
      <p className="mt-1 text-[11px] text-zinc-500">
        <span className="font-medium">Melhor quando:</span> {variant.bestWhen}
      </p>
      <div className="mt-2">
        <Button onClick={onUse} disabled={chosen} variant={chosen ? 'ghost' : 'primary'} size="sm">
          {chosen ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Gancho escolhido
            </>
          ) : (
            'Usar este gancho'
          )}
        </Button>
      </div>
    </div>
  );
}
