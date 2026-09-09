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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
      <Button
        type="button"
        variant="ghost"
        aria-label={TEXTS.ariaLabels.close}
        className="h-auto w-auto shrink-0 p-0 hover:bg-transparent"
        onClick={onClose}
      >
        <ArrowLeftIcon className="size-5 text-muted-foreground" />
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
          aria-label={searchInput ? TEXTS.ariaLabels.inputClear : TEXTS.ariaLabels.close}
          className="absolute right-2 top-2.5 h-auto w-auto p-0 hover:bg-transparent"
          onClick={handleTrailingIconClick}
        >
          <XIcon className="size-4 text-muted-foreground" />
        </Button>
      </div>
    </form>
  );
};
