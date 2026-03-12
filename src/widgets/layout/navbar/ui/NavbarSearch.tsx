import { Input } from '@/shared/ui/atoms/input';
import { SearchIcon } from 'lucide-react';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKeydown } from '@/shared/hooks/useKeydown';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { XIcon } from 'lucide-react';

export const NavbarSearch = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

  useKeydown({ key: '/' }, () => {
    inputRef.current?.focus();
  });

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = searchInput ? `?q=${encodeURIComponent(searchInput)}` : '';
    navigate(`${ROUTES_PATHS.POST.ROOT}${params}`);
    setSearchInput('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <SearchIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        id="header-search-input"
        placeholder={TEXTS.placeholders.postSearch}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
      />
      {searchInput.length > 0 ? (
        <XIcon
          className="absolute right-2 top-2.5 size-4 text-muted-foreground cursor-pointer"
          onClick={() => setSearchInput('')}
        />
      ) : (
        <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium opacity-100 flex size-5">
          <span className="text-xs">/</span>
        </Kbd>
      )}
    </form>
  );
};
