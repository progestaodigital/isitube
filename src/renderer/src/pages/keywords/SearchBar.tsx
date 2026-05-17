import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

interface SearchBarProps {
  onSearch: (term: string) => void;
  busy?: boolean;
  /** Optional external value — when changed (e.g., user picked an idea above)
   *  the input syncs to this term. The internal state continues to drive
   *  typing thereafter. */
  currentTerm?: string;
}

export function SearchBar({ onSearch, busy, currentTerm }: SearchBarProps) {
  const [value, setValue] = useState('');

  // Sync external term changes into the input. Skipped when the parent passes
  // the same term twice in a row (e.g., user re-clicked the same idea) —
  // useState's setter dedupes by reference.
  useEffect(() => {
    if (currentTerm !== undefined && currentTerm !== value) {
      setValue(currentTerm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTerm]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const items = await window.api.keywords.autocomplete(value);
      setSuggestions(items);
      setOpen(items.length > 0);
      setHighlight(-1);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSubmit(term: string) {
    if (busy) return;
    const trimmed = term.trim();
    if (!trimmed) return;
    setOpen(false);
    onSearch(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      setOpen(suggestions.length > 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = highlight >= 0 ? suggestions[highlight]! : value;
      setValue(picked);
      handleSubmit(picked);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Pesquise uma palavra-chave (ex: receitas fitness, marcenaria, finanças pessoais)"
            className="pl-10"
            disabled={busy}
            spellCheck={false}
            autoFocus
          />
        </div>
        <Button
          onClick={() => handleSubmit(value)}
          disabled={busy || !value.trim()}
          variant="primary"
        >
          {busy ? 'Buscando...' : 'Pesquisar'}
        </Button>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {suggestions.map((s, i) => (
            <button
              key={s}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => {
                setValue(s);
                handleSubmit(s);
              }}
              className={
                'flex w-full items-center gap-3 px-4 py-2 text-left text-sm ' +
                (i === highlight
                  ? 'bg-zinc-100 dark:bg-zinc-800'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800')
              }
            >
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
