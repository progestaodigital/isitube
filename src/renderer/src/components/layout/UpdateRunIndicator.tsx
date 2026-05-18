// Indicador global "atualizando canais agora" visível no Header de qualquer
// página. Aparece quando o store sinaliza isRunning=true (alimentado pelo
// evento `events:update-run-started`) e some quando completa. Click navega
// pra página Canais (onde tem mais detalhe).

import { RefreshCw } from 'lucide-react';
import { useUpdateRunStore } from '../../stores/updateRun';
import { useRouterStore } from '../../stores/router';

export function UpdateRunIndicator() {
  const isRunning = useUpdateRunStore((s) => s.isRunning);
  const navigate = useRouterStore((s) => s.navigate);

  if (!isRunning) return null;

  return (
    <button
      onClick={() => navigate('channels')}
      title="Atualizando canais — clique pra ver detalhes"
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-100 px-3 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900"
    >
      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      <span>Atualizando canais…</span>
    </button>
  );
}
