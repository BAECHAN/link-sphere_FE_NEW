import { Input } from '@/shared/ui/atoms/input';
import { SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export const MobileNavbarSearch = () => {
  const [searchInput, setSearchInput] = useState('');
  const navigate = useNavigate();

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
        id="mobile-search-input"
        autoFocus
        placeholder={TEXTS.placeholders.postSearch}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
      />
      {searchInput.length > 0 && (
        <XIcon
          className="absolute right-2 top-2.5 size-4 text-muted-foreground cursor-pointer"
          onClick={() => setSearchInput('')}
        />
      )}
    </form>
  );
};
