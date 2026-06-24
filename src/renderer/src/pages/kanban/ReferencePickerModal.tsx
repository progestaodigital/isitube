import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, BookMarked, Image as ImageIcon, Type, FileText } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import type {
  KanbanCardReference,
  KanbanReferenceType,
  LibraryItem,
} from '@shared/types';

interface ReferencePickerModalProps {
  open: boolean;
  onClose: () => void;
  existingRefs: KanbanCardReference[];
  onPick: (videoId: string, refType: KanbanReferenceType) => void;
}

export function ReferencePickerModal({
  open,
  onClose,
  existingRefs,
  onPick,
}: ReferencePickerModalProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<KanbanReferenceType>('thumb');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    window.api.library
      .list({ sort: 'recent' })
      .then((list) => {
        if (cancelled) return;
        setItems(list);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedVideoId(null);
      setSelectedType('thumb');
      setQuery('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.channelTitle ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  // Conjunto de combinações já vinculadas pra desabilitar dup.
  const existingPairs = useMemo(() => {
    const s = new Set<string>();
    for (const r of existingRefs) s.add(`${r.videoId}::${r.refType}`);
    return s;
  }, [existingRefs]);

  function handleConfirm() {
    if (!selectedVideoId) return;
    onPick(selectedVideoId, selectedType);
  }

  const alreadyExists = selectedVideoId
    ? existingPairs.has(`${selectedVideoId}::${selectedType}`)
    : false;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="space-y-4">
        <header>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <BookMarked className="h-5 w-5 text-red-600" />
            Vincular referência da biblioteca
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Escolhe um vídeo salvo, define se vai servir de referência pra thumb,
            título ou roteiro, e confirma.
          </p>
        </header>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar na biblioteca..."
            className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            autoFocus
          />
        </div>

        <div className="max-h-[40vh] space-y-1 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          {loading ? (
            <p className="p-6 text-center text-xs text-zinc-500">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-xs text-zinc-500">
              {items.length === 0
                ? 'Sua biblioteca está vazia. Salva vídeos primeiro.'
                : 'Nenhum vídeo encontrado pra essa busca.'}
            </p>
          ) : (
            filtered.map((v) => {
              const isSelected = v.id === selectedVideoId;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVideoId(v.id)}
                  className={cn(
                    'flex w-full gap-2 p-2 text-left transition-colors',
                    isSelected
                      ? 'bg-red-50 dark:bg-red-950/30'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  )}
                >
                  {(v.thumbnailHdUrl ?? v.thumbnailUrl) && (
                    <img
                      src={v.thumbnailHdUrl ?? v.thumbnailUrl ?? ''}
                      alt=""
                      className="h-12 w-20 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium">{v.title}</p>
                    {v.channelTitle && (
                      <p className="mt-0.5 text-[10px] text-zinc-500">{v.channelTitle}</p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Tipo de referência
          </p>
          <div className="grid grid-cols-3 gap-2">
            <TypeButton
              type="thumb"
              icon={ImageIcon}
              label="Thumb"
              selected={selectedType === 'thumb'}
              onClick={() => setSelectedType('thumb')}
            />
            <TypeButton
              type="titulo"
              icon={Type}
              label="Título"
              selected={selectedType === 'titulo'}
              onClick={() => setSelectedType('titulo')}
            />
            <TypeButton
              type="roteiro"
              icon={FileText}
              label="Roteiro"
              selected={selectedType === 'roteiro'}
              onClick={() => setSelectedType('roteiro')}
            />
          </div>
        </div>

        {alreadyExists && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Essa combinação já está vinculada nesse card.
          </p>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <Button onClick={onClose} variant="ghost" size="sm">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedVideoId || alreadyExists}
            variant="primary"
            size="sm"
          >
            Vincular
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

function TypeButton({
  type,
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  type: KanbanReferenceType;
  icon: typeof ImageIcon;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-ref-type={type}
      className={cn(
        'flex flex-col items-center justify-center gap-1 rounded-md border-2 py-3 text-xs font-medium transition-colors',
        selected
          ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
