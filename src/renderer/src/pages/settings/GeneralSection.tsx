import { Section } from './Section';
import { useThemeStore } from '../../stores/theme';
import { cn } from '../../lib/cn';

export function GeneralSection() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Section
      title="Geral"
      description="Aparência, idioma e preferências do app."
    >
      <div>
        <label className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Tema
        </label>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                'flex-1 rounded-lg border px-4 py-2.5 text-sm transition-colors',
                theme === t
                  ? 'border-zinc-900 bg-zinc-100 font-medium dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50'
              )}
            >
              {t === 'light' ? 'Claro' : 'Escuro'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Idioma da interface
        </label>
        <select
          disabled
          className="h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50"
        >
          <option>Português (Brasil)</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500">Outros idiomas chegam na v2.</p>
      </div>
    </Section>
  );
}
