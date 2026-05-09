import { useEffect, useState } from 'react';
import { Search, Sun, Moon, Bell, User } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import { useRouterStore } from '../../stores/router';
import type { LicenseInfo } from '@shared/types';

export function Header() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const navigate = useRouterStore((s) => s.navigate);
  const [license, setLicense] = useState<LicenseInfo | null>(null);

  useEffect(() => {
    window.api.license.get().then(setLicense);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-[#0f0f0f]">
      <div className="flex flex-1 items-center">
        <div className="relative w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Pesquisar canais, vídeos ou palavras-chave..."
            className="w-full rounded-full border border-zinc-300 bg-zinc-50 py-2 pl-10 pr-4 text-sm placeholder:text-zinc-500 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-950"
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {license && (
          <button
            onClick={() => navigate('settings')}
            title={
              license.valid
                ? `Licença ${license.planLabel}${license.isStub ? ' (modo stub)' : ''}`
                : 'Licença bloqueada — clique para resolver'
            }
            className={
              'mr-1 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors sm:inline-flex ' +
              (license.valid
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-900'
                : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400')
            }
          >
            <span
              className={
                'inline-block h-1.5 w-1.5 rounded-full ' +
                (license.valid ? 'bg-emerald-500' : 'bg-red-500')
              }
            />
            {license.plan}
          </button>
        )}
        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate('settings')}
          className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
          title="Conta e configurações"
          aria-label="Conta e configurações"
        >
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
