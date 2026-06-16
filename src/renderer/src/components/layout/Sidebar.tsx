import { useCallback, useEffect, useState } from 'react';
import {
  Home,
  Tv,
  Search,
  FileText,
  BookMarked,
  Settings,
  HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { useRouterStore, type View } from '../../stores/router';

interface NavItem {
  icon: LucideIcon;
  label: string;
  view: View;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Início', view: 'home' },
  { icon: Tv, label: 'Canais', view: 'channels' },
  { icon: Search, label: 'Palavras-chave', view: 'keywords' },
  { icon: FileText, label: 'Vídeos', view: 'videos' },
  { icon: BookMarked, label: 'Biblioteca', view: 'library' },
  { icon: Settings, label: 'Configurações', view: 'settings' },
  { icon: HelpCircle, label: 'Ajuda', view: 'help' },
];

interface Counts {
  channels: number;
  flagged: number;
  evergreen: number;
  extracted: number;
  keywordsHistory: number;
  library: number;
}

const EMPTY_COUNTS: Counts = {
  channels: 0,
  flagged: 0,
  evergreen: 0,
  extracted: 0,
  keywordsHistory: 0,
  library: 0,
};

export function Sidebar() {
  const currentView = useRouterStore((s) => s.view);
  const navigate = useRouterStore((s) => s.navigate);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    window.api.app
      .getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion(''));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [channels, flagged, evergreen, extracted, history, libraryCount] = await Promise.all([
        window.api.channels.list(),
        window.api.channels.getFlaggedVideos({ minPercent: 150 }),
        window.api.channels.analyticsEvergreen({ minViewsPerDay: 1 }),
        window.api.videos.listExtracted({}),
        window.api.keywords.history(50),
        window.api.library.count(),
      ]);
      setCounts({
        channels: channels.length,
        flagged: flagged.length,
        evergreen: evergreen.length,
        extracted: extracted.length,
        keywordsHistory: history.length,
        library: libraryCount,
      });
    } catch {
      // swallow — sidebar badges shouldn't block navigation
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on background events that change counts.
  useEffect(() => {
    const off = window.api.events.onUpdateRunCompleted(() => refresh());
    return off;
  }, [refresh]);

  // Re-poll on every navigation so counts stay reasonably fresh as the user
  // creates/removes content. Cheap (5 small queries).
  useEffect(() => {
    refresh();
  }, [currentView, refresh]);

  function badgeFor(view: View): { value: number; tint?: 'amber' | 'red' } | null {
    if (view === 'channels' && counts.flagged > 0) {
      return { value: counts.flagged, tint: 'amber' };
    }
    if (view === 'videos' && counts.extracted > 0) {
      return { value: counts.extracted };
    }
    if (view === 'keywords' && counts.keywordsHistory > 0) {
      return { value: counts.keywordsHistory };
    }
    if (view === 'library' && counts.library > 0) {
      return { value: counts.library };
    }
    return null;
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#0f0f0f]">
      <button
        onClick={() => navigate('home')}
        className="flex h-14 items-center gap-2 px-5 transition-opacity hover:opacity-80"
      >
        <div className="flex h-7 w-10 items-center justify-center rounded-md bg-red-600">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="text-lg font-semibold tracking-tight">isiTube</span>
      </button>
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {navItems.map((item) => {
          const active = item.view === currentView;
          const badge = badgeFor(item.view);
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              title={tooltipFor(item.view, counts)}
              className={cn(
                'flex w-full items-center gap-5 rounded-lg px-3 py-2.5 text-sm transition-colors',
                'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                active && 'bg-zinc-100 font-medium dark:bg-zinc-800'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {badge && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold',
                    badge.tint === 'amber'
                      ? 'bg-amber-500 text-white'
                      : badge.tint === 'red'
                        ? 'bg-red-600 text-white'
                        : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
                  )}
                >
                  {badge.value > 99 ? '99+' : badge.value}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        {appVersion ? `isiTube v${appVersion}` : 'isiTube'}
      </div>
    </aside>
  );
}

function tooltipFor(view: View, counts: Counts): string | undefined {
  switch (view) {
    case 'channels':
      return `${counts.channels} canal${counts.channels !== 1 ? 'is' : ''} · ${counts.flagged} em destaque · ${counts.evergreen} evergreen`;
    case 'videos':
      return `${counts.extracted} vídeo${counts.extracted !== 1 ? 's' : ''} com metadata extraída`;
    case 'keywords':
      return `${counts.keywordsHistory} pesquisa${counts.keywordsHistory !== 1 ? 's' : ''} no histórico`;
    case 'library':
      return `${counts.library} vídeo${counts.library !== 1 ? 's' : ''} salvo${counts.library !== 1 ? 's' : ''} na biblioteca`;
    default:
      return undefined;
  }
}
