import { cn } from '../../lib/cn';

type Status = 'missing' | 'untested' | 'valid' | 'invalid' | 'error';

interface StatusDotProps {
  status: Status;
  label?: string;
  className?: string;
}

const colors: Record<Status, string> = {
  missing: 'bg-zinc-400',
  untested: 'bg-amber-400',
  valid: 'bg-emerald-500',
  invalid: 'bg-red-500',
  error: 'bg-red-500',
};

const defaultLabels: Record<Status, string> = {
  missing: 'Não configurado',
  untested: 'Não testado',
  valid: 'Conectado',
  invalid: 'Falha na validação',
  error: 'Erro',
};

export function StatusDot({ status, label, className }: StatusDotProps) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#0f0f0f]',
          colors[status]
        )}
      />
      <span className="text-xs text-zinc-600 dark:text-zinc-400">
        {label ?? defaultLabels[status]}
      </span>
    </div>
  );
}
