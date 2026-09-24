import { forwardRef, useRef } from 'react';

import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';
import { useMergedRef } from '@/shared/hooks/useMergedRef';

import { X } from 'lucide-react';

export interface InputProps extends React.ComponentProps<'input'> {
  onClear?: () => void;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClear, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const mergedRef = useMergedRef(ref, inputRef);

    // clear 버튼은 값이 있을 때만 렌더되므로, 클릭한 순간 버튼 자신이 사라지며
    // 포커스가 <body>로 떨어진다 - 그래서 지운 뒤 입력창으로 포커스를 되돌린다.
    // 근거: https://scottaohara.github.io/clear-text-field-button/
    // ("...focus being placed into the text field.")
    const handleClear = () => {
      onClear?.();
      inputRef.current?.focus();
    };

    return (
      <>
        <input
          ref={mergedRef}
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
            <span className="sr-only">Clear</span>
          </Button>
        )}
      </>
    );
  }
);
Input.displayName = 'Input';

export { Input };
