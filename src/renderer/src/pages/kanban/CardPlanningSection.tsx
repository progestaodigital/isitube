import { useEffect, useState } from 'react';
import type { KanbanCard } from '@shared/types';
import { useToastStore } from '../../stores/toast';

interface CardPlanningSectionProps {
  card: KanbanCard;
  onChanged: () => Promise<void> | void;
}

/**
 * Anotações livres de planejamento do vídeo — o que gravar, com quem, o que
 * preparar. Deliberadamente sem agente de IA: é a caixa de rascunho do
 * criador, não um campo que vai pro YouTube (isso é o roteiro/descrição).
 *
 * Salva no blur, mesmo padrão do roteiro em CardScriptSection.
 */
export function CardPlanningSection({ card, onChanged }: CardPlanningSectionProps) {
  const showToast = useToastStore((s) => s.show);
  const [planning, setPlanning] = useState(card.planning ?? '');

  useEffect(() => {
    setPlanning(card.planning ?? '');
  }, [card.id, card.updatedAt]);

  async function persist() {
    const next = planning || null;
    if (next === (card.planning || null)) return;
    try {
      await window.api.kanban.updateCard(card.id, { planning: next });
      await onChanged();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao salvar',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <textarea
      value={planning}
      onChange={(e) => setPlanning(e.target.value)}
      onBlur={persist}
      rows={6}
      placeholder="Anotações do planejamento: o que gravar, com quem, o que preparar, prazos…"
      className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-900"
    />
  );
}
