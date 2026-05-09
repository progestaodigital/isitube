import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border bg-white px-3 text-sm transition-colors',
          'placeholder:text-zinc-400 focus:outline-none',
          'dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500',
          invalid
            ? 'border-red-500 focus:border-red-600'
            : 'border-zinc-300 focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-500',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
