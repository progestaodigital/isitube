import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Trash2,
  Image as ImageIcon,
  Star,
  Plus,
  X,
  Hash,
  Sparkles,
  BookMarked,
  ExternalLink,
  FileText,
  Type,
  Download,
  Search,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../stores/toast';
import { useRouterStore } from '../../stores/router';
import { useVideoDetailStore } from '../../stores/videoDetail';
import { cn } from '../../lib/cn';
import { ReferencePickerModal } from './ReferencePickerModal';
import type { KanbanCard, KanbanReferenceType, ThumbnailGeneration } from '@shared/types';

interface CardEditorModalProps {
  card: KanbanCard | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

export function CardEditorModal({ card, onClose, onChanged }: CardEditorModalProps) {
  const showToast = useToastStore((s) => s.show);
  const navigateToKeywordSearch = useRouterStore((s) => s.navigateToKeywordSearch);
  const openVideoDetail = useVideoDetailStore((s) => s.open);

  // Local draft state — só persiste no DB em onBlur ou Salvar.
  const [title, setTitle] = useState('');
  const [mainKeyword, setMainKeyword] = useState('');
  const [secondaryInput, setSecondaryInput] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([]);
  const [script, setScript] = useState('');
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hidrata quando o card muda (abertura ou refetch após salvar).
  useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setMainKeyword(card.mainKeyword ?? '');
    setSecondaryKeywords(card.secondaryKeywords);
    setScript(card.script ?? '');
    setSecondaryInput('');
  }, [card?.id, card?.updatedAt]);

  const persistField = useCallback(
    async (patch: { title?: string; mainKeyword?: string | null; script?: string | null; secondaryKeywords?: string[] }) => {
      if (!card) return;
      try {
        await window.api.kanban.updateCard(card.id, patch);
        await onChanged();
      } catch (err) {
        showToast({
          kind: 'error',
          title: 'Falha ao salvar',
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [card, onChanged, showToast]
  );

  function addSecondary() {
    const t = secondaryInput.trim();
    if (!t) return;
    if (secondaryKeywords.includes(t)) {
      setSecondaryInput('');
      return;
    }
    const next = [...secondaryKeywords, t];
    setSecondaryKeywords(next);
    setSecondaryInput('');
    persistField({ secondaryKeywords: next });
  }

  function removeSecondary(term: string) {
    const next = secondaryKeywords.filter((s) => s !== term);
    setSecondaryKeywords(next);
    persistField({ secondaryKeywords: next });
  }

  async function handleDelete() {
    if (!card) return;
    const ok = window.confirm(`Apagar o card "${card.title || '(sem título)'}"?`);
    if (!ok) return;
    try {
      await window.api.kanban.deleteCard(card.id);
      await onChanged();
      onClose();
      showToast({ kind: 'info', title: 'Card apagado' });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao apagar',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleUploadThumbnails(files: FileList | null) {
    if (!files || !card) return;
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (valid.length === 0) {
      showToast({ kind: 'error', title: 'Selecione um arquivo de imagem.' });
      return;
    }
    try {
      for (const file of valid) {
        const base64 = await fileToBase64(file);
        await window.api.kanban.addThumbnail(card.id, { base64, mimeType: file.type });
      }
      await onChanged();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao subir thumbnail',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSetCover(thumbId: string) {
    if (!card) return;
    try {
      await window.api.kanban.setCoverThumbnail(thumbId);
      await onChanged();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleDeleteThumbnail(thumbId: string) {
    if (!card) return;
    try {
      await window.api.kanban.deleteThumbnail(thumbId);
      await onChanged();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleExportThumbnail(thumbId: string) {
    const res = await window.api.kanban.exportThumbnail(thumbId);
    if (res.success) showToast({ kind: 'success', title: 'Salvo', description: res.path });
    else if (res.message !== 'Exportação cancelada.')
      showToast({ kind: 'error', title: 'Falha ao salvar', description: res.message });
  }

  async function handleAddFromGeneration(generationId: string) {
    if (!card) return;
    try {
      await window.api.kanban.addThumbnailFromGeneration(card.id, generationId);
      await onChanged();
      setStudioOpen(false);
      showToast({ kind: 'success', title: 'Thumbnail do estúdio adicionada ao card' });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao puxar do estúdio',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleAddReference(videoId: string, refType: KanbanReferenceType) {
    if (!card) return;
    try {
      await window.api.kanban.addReference(card.id, videoId, refType);
      await onChanged();
      setRefPickerOpen(false);
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao vincular referência',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleRemoveReference(refId: string) {
    if (!card) return;
    try {
      await window.api.kanban.removeReference(refId);
      await onChanged();
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function handleKeywordCTA() {
    if (!mainKeyword.trim()) return;
    if (card?.keywordAnalysis?.cached) {
      // Já tem cache — abre a página de keywords pra ver os detalhes da análise.
      navigateToKeywordSearch(card.keywordAnalysis.term);
    } else {
      const ok = window.confirm(
        `Essa palavra-chave ainda não foi analisada.\n\nAbrir a página de Palavras-chave e disparar a análise pra "${mainKeyword.trim()}" agora?`
      );
      if (!ok) return;
      navigateToKeywordSearch(mainKeyword.trim());
    }
  }

  if (!card) return null;

  return (
    <>
      <Modal open onClose={onClose} size="xl">
        <div className="space-y-5">
          <header>
            <p className="text-xs uppercase tracking-wider text-zinc-500">Card do Kanban</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title !== card.title) persistField({ title });
              }}
              placeholder="Sem título"
              className="mt-1 w-full bg-transparent text-xl font-semibold leading-tight focus:outline-none"
            />
          </header>

          {/* Palavra-chave principal */}
          <Section icon={Hash} title="Palavra-chave principal">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={mainKeyword}
                onChange={(e) => setMainKeyword(e.target.value)}
                onBlur={() => {
                  if ((mainKeyword || null) !== (card.mainKeyword || null)) {
                    persistField({ mainKeyword: mainKeyword.trim() || null });
                  }
                }}
                placeholder="ex.: como fazer renda extra"
                className="flex-1 min-w-[200px] rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              {mainKeyword.trim() && (
                <KeywordAnalysisBadge
                  analysis={card.keywordAnalysis}
                  onClick={handleKeywordCTA}
                />
              )}
            </div>
          </Section>

          {/* Palavras-chave secundárias */}
          <Section icon={Hash} title="Palavras-chave secundárias">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {secondaryKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {kw}
                    <button
                      onClick={() => removeSecondary(kw)}
                      className="text-zinc-400 hover:text-red-500"
                      aria-label={`Remover ${kw}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={secondaryInput}
                  onChange={(e) => setSecondaryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addSecondary();
                    }
                  }}
                  placeholder="adiciona uma e Enter"
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                />
                <Button onClick={addSecondary} size="sm" variant="secondary">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </div>
          </Section>

          {/* Roteiro */}
          <Section icon={FileText} title="Roteiro">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              onBlur={() => {
                if ((script || null) !== (card.script || null)) {
                  persistField({ script: script || null });
                }
              }}
              rows={8}
              placeholder="Hook, lista de bullets, blocos do vídeo..."
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900"
            />
          </Section>

          {/* Thumbnails */}
          <Section icon={ImageIcon} title={`Thumbnails (${card.thumbnails.length})`}>
            <div className="space-y-2">
              {card.thumbnails.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {card.thumbnails.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        'group relative overflow-hidden rounded-md border',
                        t.isCover
                          ? 'border-red-400 ring-2 ring-red-500/40'
                          : 'border-zinc-200 dark:border-zinc-800'
                      )}
                    >
                      <img
                        src={t.dataUrl}
                        alt=""
                        className="aspect-video w-full object-cover"
                        draggable={false}
                      />
                      {t.isCover && (
                        <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          Capa
                        </span>
                      )}
                      <div className="absolute inset-0 flex items-end justify-end gap-1 bg-black/0 p-1 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                        {!t.isCover && (
                          <button
                            onClick={() => handleSetCover(t.id)}
                            title="Definir como capa"
                            className="rounded-md bg-white/90 p-1 text-zinc-700 hover:bg-white"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleExportThumbnail(t.id)}
                          title="Baixar"
                          className="rounded-md bg-white/90 p-1 text-zinc-700 hover:bg-white"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteThumbnail(t.id)}
                          title="Apagar thumbnail"
                          className="rounded-md bg-white/90 p-1 text-red-600 hover:bg-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleUploadThumbnails(e.target.files);
                  e.target.value = '';
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Subir thumbnail{card.thumbnails.length === 0 ? '' : ' (mais uma)'}
                </Button>
                <Button onClick={() => setStudioOpen((v) => !v)} variant="secondary" size="sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Puxar do estúdio
                </Button>
              </div>
              {studioOpen && <StudioPicker onPick={handleAddFromGeneration} />}
              {card.thumbnails.length > 1 && (
                <p className="text-[11px] text-zinc-500">
                  A capa do card é a thumb marcada com <Star className="inline h-3 w-3" />.
                  Clica na estrela de qualquer outra pra trocar.
                </p>
              )}
            </div>
          </Section>

          {/* Referências da biblioteca */}
          <Section icon={BookMarked} title={`Referências (${card.references.length})`}>
            <div className="space-y-2">
              {card.references.length === 0 && (
                <p className="text-xs italic text-zinc-500">
                  Nenhuma referência. Vincula vídeos da sua biblioteca pra usar como
                  inspiração de thumbnail, título ou roteiro.
                </p>
              )}
              {card.references.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <button
                    onClick={() => openVideoDetail(ref.videoId)}
                    className="flex flex-1 items-center gap-2 text-left"
                    title="Abrir vídeo da biblioteca"
                  >
                    {ref.videoThumbnailUrl && (
                      <img
                        src={ref.videoThumbnailUrl}
                        alt=""
                        className="h-9 w-16 shrink-0 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{ref.videoTitle}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <ReferenceTypeBadge type={ref.refType} />
                        {ref.videoChannelTitle && (
                          <span className="truncate">{ref.videoChannelTitle}</span>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 shrink-0 text-zinc-400" />
                  </button>
                  <button
                    onClick={() => handleRemoveReference(ref.id)}
                    className="rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                    aria-label="Remover referência"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button
                onClick={() => setRefPickerOpen(true)}
                variant="secondary"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Vincular da biblioteca
              </Button>
            </div>
          </Section>

          <footer className="flex items-center justify-between border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <Button
              onClick={handleDelete}
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Apagar card
            </Button>
            <Button onClick={onClose} variant="secondary" size="sm">
              Fechar
            </Button>
          </footer>
        </div>
      </Modal>

      <ReferencePickerModal
        open={refPickerOpen}
        onClose={() => setRefPickerOpen(false)}
        existingRefs={card.references}
        onPick={handleAddReference}
      />
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader retornou tipo inesperado'));
        return;
      }
      // result vem como "data:image/png;base64,XXXX" — pega só a parte base64.
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Hash;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function KeywordAnalysisBadge({
  analysis,
  onClick,
}: {
  analysis: KanbanCard['keywordAnalysis'];
  onClick: () => void;
}) {
  if (!analysis) {
    return null;
  }
  if (analysis.cached) {
    const score = analysis.scoreValue;
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
        title="Abrir análise dessa palavra-chave"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Análise vinculada{score !== null && ` · ${Math.round(score)}/100`}
        <ExternalLink className="h-3 w-3 opacity-70" />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
      title="Disparar a análise dessa palavra-chave agora"
    >
      <Sparkles className="h-3.5 w-3.5" />
      Sem análise — analisar agora?
    </button>
  );
}

function ReferenceTypeBadge({ type }: { type: KanbanReferenceType }) {
  const config: Record<KanbanReferenceType, { label: string; icon: typeof Type; className: string }> = {
    thumb: {
      label: 'Thumb',
      icon: ImageIcon,
      className: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300',
    },
    titulo: {
      label: 'Título',
      icon: Type,
      className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    },
    roteiro: {
      label: 'Roteiro',
      icon: FileText,
      className: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    },
  };
  const { label, icon: Icon, className } = config[type];
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase', className)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function StudioPicker({ onPick }: { onPick: (generationId: string) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ThumbnailGeneration[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await window.api.thumbnails.searchGenerations(query);
        if (!cancelled) setResults(r);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por código (ID) ou termo do prompt…"
          className="h-8 w-full rounded-md border border-zinc-300 bg-white pl-7 pr-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {loading && <p className="mt-2 text-[11px] text-zinc-500">Buscando…</p>}
      {!loading && results.length === 0 && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Nenhuma thumbnail no estúdio. Gere em <b>Thumbnails</b> primeiro.
        </p>
      )}
      {results.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {results.map((g) => (
            <button
              key={g.id}
              onClick={() => onPick(g.id)}
              title={g.prompt}
              className="group overflow-hidden rounded-md border border-zinc-200 text-left transition-colors hover:border-red-300 dark:border-zinc-800 dark:hover:border-red-800"
            >
              <div className="relative">
                <img src={g.dataUrl} alt="" className="aspect-video w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                  <Plus className="h-5 w-5 text-white" />
                </span>
              </div>
              <p className="px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                #{g.id.slice(0, 8).toUpperCase()}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
