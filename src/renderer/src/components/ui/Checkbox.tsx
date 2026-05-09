import { useEffect, useRef } from 'react';
import { cn } from '../../lib/cn';

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  ariaLabel?: string;
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  className,
  ariaLabel,
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate && !checked);
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer rounded border-zinc-300 text-red-600 transition-colors',
        'focus:ring-2 focus:ring-red-500 focus:ring-offset-0',
        'dark:border-zinc-600 dark:bg-zinc-800 dark:checked:bg-red-600',
        className
      )}
    />
  );
}
