import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { CategoryPicker, type PickedCategory } from '../../components/categories/CategoryPicker';
import { useCategories } from '../../hooks/useCategories';
import type { ChannelInfo } from '@shared/types';

interface EditChannelCategoriesDialogProps {
  channel: ChannelInfo | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditChannelCategoriesDialog({
  channel,
  onClose,
  onSaved,
}: EditChannelCategoriesDialogProps) {
  const { categories, refresh } = useCategories();
  const [picked, setPicked] = useState<PickedCategory[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (channel) {
      refresh();
      setPicked(
        channel.categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))
      );
    } else {
      setPicked([]);
    }
  }, [channel, refresh]);

  async function handleSave() {
    if (!channel) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const p of picked) {
        if (p.id) {
          ids.push(p.id);
          continue;
        }
        const result = await window.api.categories.create(p.name);
        if (result.category) ids.push(result.category.id);
      }
      await window.api.categories.setForChannel(channel.id, ids);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(channel)}
      onClose={() => !busy && onClose()}
      title="Editar categorias"
      description={channel ? channel.title : ''}
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Categorias
          </label>
          <CategoryPicker
            value={picked}
            onChange={setPicked}
            available={categories}
            disabled={busy}
            placeholder="Ex: Tech, Tutoriais..."
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Digite + Enter pra criar nova. Vazio = sem categoria.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} disabled={busy} variant="ghost" size="sm">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={busy} variant="primary" size="sm">
            {busy ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
