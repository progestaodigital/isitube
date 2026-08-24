import { useEffect, useState } from 'react';
import { Search, Loader2, Plus, X, Check } from 'lucide-react';
import type { KanbanCard, SeoTitleVariant, VideoChapter } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../stores/toast';
import { cn } from '../../lib/cn';

interface CardSeoSectionProps {
  card: KanbanCard;
  onChanged: () => Promise<void> | void;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function CardSeoSection({ card, onChanged }: CardSeoSectionProps) {
  const showToast = useToastStore((s) => s.show);
  const [busy, setBusy] = useState(false);
  const [variants, setVariants] = useState<SeoTitleVariant[]>([]);
  const [description, setDescription] = useState(card.description ?? '');

  useEffect(() => {
    setDescription(card.description ?? '');
  }, [card.id, card.updatedAt]);

  async function persist(patch: Parameters<typeof window.api.kanban.updateCard>[1]) {
    try {
      await window.api.kanban.updateCard(card.id, patch);
      await onChanged();
    } catch (err) {
      showToast({ kind: 'error', title: 'Falha ao salvar', description: msg(err) });
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await window.api.ai.generateCardSeo(card.id);
      setVariants(res.seo.titleVariants);
      await onChanged();
      showToast({
        kind: 'success',
        title: 'SEO gerado',
        description: 'Título, descrição, tags, capítulos e hashtags preenchidos.',
      });
    } catch (err) {
      showToast({ kind: 'error', title: 'Falha ao gerar SEO', description: msg(err) });
    } finally {
      setBusy(false);
    }
  }

  async function pickTitle(v: SeoTitleVariant) {
    await persist({ title: v.title });
    // Vincula a referência de estilo como referência de TÍTULO no card.
    if (v.referenceVideoId) {
      try {
        await window.api.kanban.addReference(card.id, v.referenceVideoId, 'titulo');
        await onChanged();
      } catch {
        // já vinculado (unique constraint) — ignora
      }
    }
  }

  const hasContent =
    Boolean(card.description) ||
    card.tags.length > 0 ||
    card.chapters.length > 0 ||
    card.hashtags.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={busy} variant="secondary" size="sm">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {busy ? 'Gerando…' : hasContent ? 'Regerar SEO/metadados' : 'Gerar SEO/metadados'}
        </Button>
        <span className="text-[11px] text-zinc-500">
          Usa o conteúdo do card (título, keyword, roteiro) e preenche os campos abaixo.
        </span>
      </div>

      {variants.length > 0 && (
        <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
          <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
            Variações de título — clique pra usar
          </p>
          <div className="space-y-1.5">
            {variants.map((v) => {
              const active = v.title === card.title;
              return (
                <button
                  key={v.title}
                  onClick={() => pickTitle(v)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                    active
                      ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
                  )}
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-zinc-200 px-1.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {v.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{v.title}</span>
                    <span className="block text-zinc-500">{v.rationale}</span>
                    {v.referenceTitle && (
                      <span className="mt-0.5 block text-[10px] text-sky-600 dark:text-sky-400">
                        ↳ modelado em: “{v.referenceTitle}”
                        {!v.referenceVideoId && ' (não achei na biblioteca)'}
                      </span>
                    )}
                  </span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasContent && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-zinc-500">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if ((description || null) !== (card.description || null)) {
                  persist({ description: description || null });
                }
              }}
              rows={6}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <ChapterEditor
            chapters={card.chapters}
            onChange={(chapters) => persist({ chapters })}
          />

          <EditableChips
            label="Tags"
            items={card.tags}
            onChange={(tags) => persist({ tags })}
            placeholder="adiciona uma tag e Enter"
          />

          <EditableChips
            label="Hashtags"
            items={card.hashtags}
            onChange={(hashtags) => persist({ hashtags })}
            placeholder="#hashtag e Enter"
            normalize={(v) => (v.startsWith('#') ? v : `#${v}`)}
          />
        </div>
      )}
    </div>
  );
}

function EditableChips({
  label,
  items,
  onChange,
  placeholder,
  normalize,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  normalize?: (v: string) => string;
}) {
  const [input, setInput] = useState('');

  function add() {
    const raw = input.trim();
    if (!raw) return;
    const value = normalize ? normalize(raw) : raw;
    if (items.includes(value)) {
      setInput('');
      return;
    }
    onChange([...items, value]);
    setInput('');
  }

  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-500">
        {label} ({items.length})
      </label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {it}
            <button
              onClick={() => onChange(items.filter((x) => x !== it))}
              className="text-zinc-400 hover:text-red-500"
              aria-label={`Remover ${it}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button onClick={add} size="sm" variant="secondary">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ChapterEditor({
  chapters,
  onChange,
}: {
  chapters: VideoChapter[];
  onChange: (next: VideoChapter[]) => void;
}) {
  if (chapters.length === 0) return null;
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-zinc-500">
        Capítulos ({chapters.length})
      </label>
      <div className="space-y-1">
        {chapters.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={c.timestamp}
              onChange={(e) => {
                const next = [...chapters];
                next[i] = { ...c, timestamp: e.target.value };
                onChange(next);
              }}
              className="w-16 shrink-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-center font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={c.label}
              onChange={(e) => {
                const next = [...chapters];
                next[i] = { ...c, label: e.target.value };
                onChange(next);
              }}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={() => onChange(chapters.filter((_, j) => j !== i))}
              className="shrink-0 text-zinc-400 hover:text-red-500"
              aria-label="Remover capítulo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
