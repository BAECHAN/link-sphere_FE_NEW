import { forwardRef } from 'react';

import { cn } from '@/shared/lib/tailwind/utils';

import { X } from 'lucide-react';

export interface InputProps extends React.ComponentProps<'input'> {
  onClear?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClear, ...props }, ref) => {
    return (
      <>
        <input
          ref={ref}
          type={type}
          className={cn(
            'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent pl-3 pr-8 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            className
          )}
          {...props}
        />
        {props.value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="size-6" />
            <span className="sr-only">Clear</span>
          </button>
        )}
      </>
    );
  }
);
Input.displayName = 'Input';

export { Input };
