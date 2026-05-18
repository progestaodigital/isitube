import { Search, Sun, Moon, Bell, User } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import { useRouterStore } from '../../stores/router';
import { UpdateBadge } from './UpdateBadge';
import { UpdateRunIndicator } from './UpdateRunIndicator';
import { PlanBadge } from '../license/PlanBadge';
import { useLicense } from '../../hooks/useLicense';

export function Header() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const navigate = useRouterStore((s) => s.navigate);
  const { info } = useLicense();

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
        <UpdateRunIndicator />
        <UpdateBadge />
        {info && (
          <PlanBadge
            info={info}
            onClick={() => navigate('settings')}
            className="mr-1 hidden sm:inline-flex"
          />
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
