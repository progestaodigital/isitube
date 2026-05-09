type Size = 'xs' | 'sm';

interface CategoryBadgeProps {
  name: string;
  color: string | null | undefined;
  size?: Size;
  onClick?: () => void;
  active?: boolean;
}

/**
 * Small chip showing a category name with optional color tint. When `color`
 * is null we use a neutral zinc background so the UI stays consistent.
 */
export function CategoryBadge({
  name,
  color,
  size = 'sm',
  onClick,
  active,
}: CategoryBadgeProps) {
  const padding = size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs';
  const ring = active ? 'ring-2 ring-offset-1 dark:ring-offset-zinc-900' : '';

  const style: React.CSSProperties = color
    ? {
        backgroundColor: color + (active ? '33' : '22'),
        color: color,
        borderColor: color + '55',
      }
    : {};

  const baseClasses = color
    ? `inline-flex items-center gap-1 rounded-full border ${padding} font-medium ${ring}`
    : `inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 ${padding} font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 ${ring}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} cursor-pointer transition-opacity hover:opacity-80`}
        style={style}
      >
        {name}
      </button>
    );
  }
  return (
    <span className={baseClasses} style={style}>
      {name}
    </span>
  );
}
