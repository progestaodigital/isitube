import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Tag } from 'lucide-react';
import type { CategoryInfo } from '@shared/types';
import { CategoryBadge } from './CategoryBadge';

interface CategoryPickerProps {
  /**
   * Currently selected categories. May contain entries with only a name
   * (created inline, not yet persisted) or only an id (persisted).
   */
  value: PickedCategory[];
  onChange: (next: PickedCategory[]) => void;
  /** All persisted categories — used for the suggestion list. */
  available: CategoryInfo[];
  placeholder?: string;
  disabled?: boolean;
}

export type PickedCategory = {
  id?: string;
  name: string;
  color?: string | null;
};

/**
 * Multi-select with inline creation: type a new name + Enter (or comma) to
 * add as a pending category, click an existing one to add by id.
 */
export function CategoryPicker({
  value,
  onChange,
  available,
  placeholder = 'Adicionar categoria...',
  disabled,
}: CategoryPickerProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectedKeys = useMemo(() => {
    return new Set(
      value.map((v) => v.id ?? `name:${v.name.toLowerCase().trim()}`)
    );
  }, [value]);

  const suggestions = useMemo(() => {
    const q = input.trim().toLowerCase();
    return available
      .filter((c) => !selectedKeys.has(c.id))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [available, selectedKeys, input]);

  const trimmed = input.trim();
  const exactMatch = available.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  const showCreateOption =
    trimmed.length > 0 && !exactMatch && !selectedKeys.has(`name:${trimmed.toLowerCase()}`);

  function addExisting(c: CategoryInfo) {
    if (selectedKeys.has(c.id)) return;
    onChange([...value, { id: c.id, name: c.name, color: c.color }]);
    setInput('');
  }

  function addNew(name: string) {
    const cleaned = name.trim();
    if (!cleaned) return;
    if (selectedKeys.has(`name:${cleaned.toLowerCase()}`)) return;
    if (exactMatch) {
      addExisting(exactMatch);
      return;
    }
    onChange([...value, { name: cleaned }]);
    setInput('');
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      if (trimmed) {
        e.preventDefault();
        if (exactMatch) addExisting(exactMatch);
        else addNew(trimmed);
      }
    } else if (e.key === 'Backspace' && !input && value.length > 0) {
      remove(value.length - 1);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 ${
          disabled ? 'opacity-50' : ''
        }`}
      >
        {value.length === 0 && !input && (
          <Tag className="h-3.5 w-3.5 text-zinc-400" />
        )}
        {value.map((cat, idx) => (
          <span
            key={cat.id ?? `name:${cat.name}`}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
            style={
              cat.color
                ? {
                    backgroundColor: cat.color + '22',
                    color: cat.color,
                  }
                : undefined
            }
          >
            {!cat.id && <span className="text-[9px] opacity-70">novo</span>}
            <span className="font-medium">{cat.name}</span>
            <button
              type="button"
              onClick={() => remove(idx)}
              disabled={disabled}
              className="rounded-full p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"
              title="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
      </div>

      {open && !disabled && (suggestions.length > 0 || showCreateOption) && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {showCreateOption && (
            <button
              type="button"
              onClick={() => addNew(trimmed)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-500" />
              <span>
                Criar categoria <b>"{trimmed}"</b>
              </span>
            </button>
          )}
          {suggestions.length > 0 && showCreateOption && (
            <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          )}
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => addExisting(c)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="flex items-center gap-2">
                <CategoryBadge name={c.name} color={c.color} size="xs" />
              </span>
              <span className="text-[10px] text-zinc-500">
                {c.channelCount} canal{c.channelCount !== 1 ? 'is' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
