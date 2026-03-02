import { Input, InputProps } from '@/shared/ui/atoms/input';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { cn } from '@/shared/lib/tailwind/utils';
import { useKeydown } from '@/shared/hooks/useKeydown';
import { forwardRef, useRef } from 'react';
import { useMergedRef } from '@/shared/hooks/useMergedRef';
import { SearchIcon } from 'lucide-react';

export interface SearchInputProps extends InputProps {
  shortcut?: string;
}

const inputVariant = `
pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20`;

const kbdVariant = `pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border px-1.5 font-mono font-bold opacity-100 flex bg-gray-400 text-white`;
const kbdVariantSize = 'size-5';

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ shortcut, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const mergedRef = useMergedRef(ref, inputRef);

    useKeydown({ key: shortcut ?? 'unreachable-key' }, () => {
      if (shortcut) {
        inputRef.current?.focus();
      }
    });

    return (
      <div className="relative w-full">
        <SearchIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input ref={mergedRef} className={inputVariant} {...props} />
        {shortcut && !props.value && (
          <Kbd className={cn(kbdVariant, kbdVariantSize)}>
            <span className="text-xs">{shortcut}</span>
          </Kbd>
        )}
      </div>
    );
  }
);
