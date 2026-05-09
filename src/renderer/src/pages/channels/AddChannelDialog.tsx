import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { CategoryPicker, type PickedCategory } from '../../components/categories/CategoryPicker';
import { useCategories } from '../../hooks/useCategories';

interface AddChannelDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function AddChannelDialog({ open, onClose, onAdded }: AddChannelDialogProps) {
  const { categories, refresh: refreshCategories } = useCategories();

  const [value, setValue] = useState('');
  const [picked, setPicked] = useState<PickedCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Reload categories whenever the modal opens (in case other surfaces created any).
  useEffect(() => {
    if (open) refreshCategories();
  }, [open, refreshCategories]);

  async function handleSubmit() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      // Resolve any new (id-less) categories first so we pass real ids to add.
      const ids: string[] = [];
      for (const p of picked) {
        if (p.id) {
          ids.push(p.id);
          continue;
        }
        const result = await window.api.categories.create(p.name);
        if (result.category) ids.push(result.category.id);
      }
      const res = await window.api.channels.add(value, ids);
      if (res.success) {
        setFeedback({ kind: 'ok', text: res.message });
        setValue('');
        setPicked([]);
        onAdded();
      } else {
        setFeedback({ kind: 'err', text: res.message });
      }
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Falha desconhecida.',
      });
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setValue('');
    setPicked([]);
    setFeedback(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Cadastrar canal"
      description="Cole a URL do canal ou o ID. Aceitamos canal/UC..., @handle, /c/nome ou texto livre."
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Canal
          </label>
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="https://youtube.com/@nome-do-canal ou UCxxxxxxxx..."
            disabled={busy}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Categorias <span className="text-zinc-400">(opcional)</span>
          </label>
          <CategoryPicker
            value={picked}
            onChange={setPicked}
            available={categories}
            disabled={busy}
            placeholder="Ex: Tech, Tutoriais, Concorrentes..."
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Digite + Enter pra criar nova. Clique nas existentes pra reutilizar.
          </p>
        </div>

        {feedback && (
          <p
            className={
              feedback.kind === 'ok'
                ? 'text-xs text-emerald-600 dark:text-emerald-400'
                : 'text-xs text-red-600 dark:text-red-400'
            }
          >
            {feedback.text}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={handleClose} variant="ghost" size="sm">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy || !value.trim()}
            variant="primary"
            size="sm"
          >
            {busy ? 'Buscando...' : 'Cadastrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
