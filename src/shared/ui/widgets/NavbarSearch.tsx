import { Input } from '@/shared/ui/atoms/input';
import { SearchIcon } from 'lucide-react';
import { Kbd } from '@/shared/ui/atoms/kbd';

export const NavbarSearch = () => {
  return (
    <div className="relative w-full">
      <SearchIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
      <Input
        id="header-search-input"
        placeholder="키워드나 @카테고리..."
        value={''}
        onChange={() => {}}
        className="pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
      />
      <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium opacity-100 flex size-5">
        <span className="text-xs">/</span>
      </Kbd>
    </div>
  );
};
