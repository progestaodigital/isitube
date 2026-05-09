import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Tag, Check } from 'lucide-react';
import type { CategoryInfo } from '@shared/types';

interface CategoryFilterProps {
  categories: CategoryInfo[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}

/**
 * Compact dropdown filter — multi-select with "Todas" reset. Used in flagged
 * videos, comparative analytics, and evergreen tabs.
 */
export function CategoryFilter({ categories, selectedIds, onChange }: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectedCount = selectedIds.length;
  const allSelected = selectedCount === 0;

  function toggle(id: string) {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  function clearAll() {
    onChange([]);
  }

  if (categories.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 text-xs hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
      >
        <Tag className="h-3.5 w-3.5" />
        <span>
          {allSelected
            ? 'Todas categorias'
            : selectedCount === 1
              ? categories.find((c) => c.id === selectedIds[0])?.name ?? '1 categoria'
              : `${selectedCount} categorias`}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={clearAll}
            className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              allSelected ? 'font-semibold' : ''
            }`}
          >
            <span>Todas categorias</span>
            {allSelected && <Check className="h-3.5 w-3.5 text-blue-500" />}
          </button>
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          {categories.map((c) => {
            const sel = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: c.color ?? '#a1a1aa' }}
                  />
                  <span className={sel ? 'font-medium' : ''}>{c.name}</span>
                  <span className="text-[10px] text-zinc-500">({c.channelCount})</span>
                </span>
                {sel && <Check className="h-3.5 w-3.5 text-blue-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
