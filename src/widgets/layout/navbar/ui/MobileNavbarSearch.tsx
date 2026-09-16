import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import { ArrowLeftIcon, SearchIcon, XIcon } from 'lucide-react';
import { TEXTS } from '@/shared/config/texts';
import { useNavbarSearch } from '@/widgets/layout/navbar/hooks/useNavbarSearch';

interface MobileNavbarSearchProps {
  onClose: () => void;
  onSubmit: (query: string) => void;
}

export const MobileNavbarSearch = ({ onClose, onSubmit }: MobileNavbarSearchProps) => {
  const { searchInput, setSearchInput } = useNavbarSearch();

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
    <form onSubmit={handleSubmit} className="flex items-center w-full">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative -left-1.5"
        aria-label={TEXTS.ariaLabels.close}
        onClick={onClose}
      >
        <ArrowLeftIcon className="size-6 text-muted-foreground" />
      </Button>
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={searchInput ? TEXTS.ariaLabels.inputClear : TEXTS.ariaLabels.close}
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={handleTrailingIconClick}
        >
          <XIcon className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </form>
  );
};
