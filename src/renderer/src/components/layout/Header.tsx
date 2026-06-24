import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Sun, Moon, Bell, User, Loader2, X, Tv, FileText, Hash } from 'lucide-react';
import { useThemeStore } from '../../stores/theme';
import { useRouterStore } from '../../stores/router';
import { useVideoDetailStore } from '../../stores/videoDetail';
import { UpdateBadge } from './UpdateBadge';
import { UpdateRunIndicator } from './UpdateRunIndicator';
import { PlanBadge } from '../license/PlanBadge';
import { useLicense } from '../../hooks/useLicense';
import { cn } from '../../lib/cn';
import type { GlobalSearchResult } from '@shared/types';

const EMPTY_RESULT: GlobalSearchResult = { channels: [], videos: [], keywords: [] };
const DEBOUNCE_MS = 200;

export function Header() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const navigate = useRouterStore((s) => s.navigate);
  const navigateToKeywordSearch = useRouterStore((s) => s.navigateToKeywordSearch);
  const openVideoDetail = useVideoDetailStore((s) => s.open);
  const { info } = useLicense();

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced fetch — racing-safe (descarta resultados de queries antigas).
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResult(EMPTY_RESULT);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await window.api.search.global(trimmed);
        if (!cancelled) setResult(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // Fecha dropdown ao clicar fora.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Esc fecha + limpa foco.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResult(EMPTY_RESULT);
    inputRef.current?.focus();
  }, []);

  function closeAfterAction() {
    setOpen(false);
    setQuery('');
    setResult(EMPTY_RESULT);
  }

  const total =
    result.channels.length + result.videos.length + result.keywords.length;
  const showDropdown = open && query.trim().length > 0;
  const showEmpty = showDropdown && !loading && total === 0;

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-[#0f0f0f]">
      <div className="flex flex-1 items-center">
        <div ref={containerRef} className="relative w-full max-w-2xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="Pesquisar canais, vídeos ou palavras-chave..."
            className="w-full rounded-full border border-zinc-300 bg-zinc-50 py-2 pl-10 pr-10 text-sm placeholder:text-zinc-500 focus:border-zinc-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-950"
          />
          {query && (
            <button
              onClick={clear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Limpar busca"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          )}

          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
              {loading && total === 0 && (
                <p className="p-4 text-center text-xs text-zinc-500">Buscando…</p>
              )}

              {showEmpty && (
                <p className="p-4 text-center text-xs text-zinc-500">
                  Nada encontrado pra <b>"{query}"</b>.
                </p>
              )}

              {result.channels.length > 0 && (
                <ResultSection title="Canais" icon={Tv}>
                  {result.channels.map((c) => (
                    <ResultRow
                      key={c.id}
                      thumb={c.thumbnailUrl}
                      thumbShape="circle"
                      title={c.title}
                      subtitle={c.subtitle}
                      onClick={() => {
                        navigate('channels');
                        closeAfterAction();
                      }}
                    />
                  ))}
                </ResultSection>
              )}

              {result.videos.length > 0 && (
                <ResultSection title="Vídeos" icon={FileText}>
                  {result.videos.map((v) => (
                    <ResultRow
                      key={v.id}
                      thumb={v.thumbnailUrl}
                      thumbShape="rect"
                      title={v.title}
                      subtitle={v.subtitle}
                      onClick={() => {
                        openVideoDetail(v.id);
                        closeAfterAction();
                      }}
                    />
                  ))}
                </ResultSection>
              )}

              {result.keywords.length > 0 && (
                <ResultSection title="Palavras-chave" icon={Hash}>
                  {result.keywords.map((k) => (
                    <ResultRow
                      key={k.id}
                      thumb={null}
                      thumbShape="rect"
                      title={k.term}
                      subtitle={
                        k.scoreValue !== null
                          ? `Score ${Math.round(k.scoreValue)}/100`
                          : 'Sem score'
                      }
                      onClick={() => {
                        navigateToKeywordSearch(k.term);
                        closeAfterAction();
                      }}
                    />
                  ))}
                </ResultSection>
              )}
            </div>
          )}
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

function ResultSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Tv;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900/60">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultRow({
  thumb,
  thumbShape,
  title,
  subtitle,
  onClick,
}: {
  thumb: string | null;
  thumbShape: 'circle' | 'rect';
  title: string;
  subtitle: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
    >
      {thumb ? (
        <img
          src={thumb}
          alt=""
          className={cn(
            'shrink-0 object-cover',
            thumbShape === 'circle' ? 'h-8 w-8 rounded-full' : 'h-8 w-14 rounded'
          )}
        />
      ) : (
        <div
          className={cn(
            'shrink-0 bg-zinc-200 dark:bg-zinc-800',
            thumbShape === 'circle' ? 'h-8 w-8 rounded-full' : 'h-8 w-14 rounded'
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{title}</p>
        {subtitle && (
          <p className="truncate text-[11px] text-zinc-500">{subtitle}</p>
        )}
      </div>
    </button>
  );
}
