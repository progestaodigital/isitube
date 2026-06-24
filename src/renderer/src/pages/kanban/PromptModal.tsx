import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

/**
 * Pequeno substituto pro window.prompt nativo, que o Chromium do Electron
 * bloqueia silenciosamente. Usado pra criar/renomear colunas.
 */
interface PromptModalProps {
  open: boolean;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

export function PromptModal({
  open,
  title,
  description,
  initialValue = '',
  placeholder,
  confirmLabel = 'Confirmar',
  onConfirm,
  onClose,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  function handleConfirm() {
    const v = value.trim();
    if (!v) return;
    onConfirm(v);
  }

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="space-y-4">
        <header>
          <h3 className="text-base font-semibold">{title}</h3>
          {description && (
            <p className="mt-1 text-xs text-zinc-500">{description}</p>
          )}
        </header>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleConfirm();
            } else if (e.key === 'Escape') {
              onClose();
            }
          }}
          placeholder={placeholder}
          autoFocus
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <footer className="flex justify-end gap-2">
          <Button onClick={onClose} variant="ghost" size="sm">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!value.trim()}
            variant="primary"
            size="sm"
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
