import { Input } from '@/shared/ui/atoms/input';
import { ArrowLeftIcon, SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { TEXTS } from '@/shared/config/texts';

interface MobileNavbarSearchProps {
  onClose: () => void;
  onSubmit: (query: string) => void;
}

export const MobileNavbarSearch = ({ onClose, onSubmit }: MobileNavbarSearchProps) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onSubmit(searchInput);
  };

  const handleTrailingIconClick = () => {
    if (searchInput) {
      setSearchInput('');
    } else {
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
      <button
        type="button"
        aria-label={TEXTS.ariaLabels.close}
        className="shrink-0"
        onClick={onClose}
      >
        <ArrowLeftIcon className="size-5 text-muted-foreground" />
      </button>
      <div className="relative flex-1">
        <SearchIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input
          id="mobile-search-input"
          autoFocus
          placeholder={TEXTS.placeholders.postSearch}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="button"
          aria-label={searchInput ? TEXTS.ariaLabels.inputClear : TEXTS.ariaLabels.close}
          className="absolute right-2 top-2.5"
          onClick={handleTrailingIconClick}
        >
          <XIcon className="size-4 text-muted-foreground" />
        </button>
      </div>
    </form>
  );
};
