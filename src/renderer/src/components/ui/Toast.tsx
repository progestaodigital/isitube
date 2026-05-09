import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useToastStore } from '../../stores/toast';
import { cn } from '../../lib/cn';

const icons = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
};

const accentClasses = {
  success: 'text-emerald-500',
  info: 'text-blue-500',
  error: 'text-red-500',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div
            key={t.id}
            className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', accentClasses[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
