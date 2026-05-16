// Chip pequeno com o nome do plano + bullet pulsante. Usado no Header e no
// topo da LicenseSection. Cor reflete `valid`: verde (ativa) ou vermelho.

import type { LicenseInfo } from '@shared/types';

interface PlanBadgeProps {
  info: LicenseInfo;
  onClick?: () => void;
  className?: string;
}

export function PlanBadge({ info, onClick, className = '' }: PlanBadgeProps) {
  const label = info.valid
    ? info.plan === 'pro'
      ? 'PRO'
      : 'INICIANTE'
    : 'BLOQUEADA';

  const tone = info.valid
    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900'
    : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900';

  const dot = info.valid ? 'bg-emerald-500' : 'bg-red-500';

  const Component = onClick ? 'button' : 'span';

  return (
    <Component
      onClick={onClick}
      className={
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors ' +
        tone +
        ' ' +
        className
      }
    >
      <span className={'inline-block h-1.5 w-1.5 rounded-full ' + dot} />
      {label}
    </Component>
  );
}
