import { SearchInput } from '@/shared/ui/elements/SearchInput';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';
import { useBookmarkSearch } from '@/widgets/bookmark/bookmark-search/hooks/useBookmarkSearch';

interface BookmarkSearchProps {
  className?: string;
}

export function BookmarkSearch({ className }: BookmarkSearchProps) {
  const { searchInput, setSearchInput, handleSubmit, handleClear } = useBookmarkSearch();

  return (
    <form onSubmit={handleSubmit} className={cn('flex gap-2', className)}>
      <SearchInput
        name="bookmark-search-input"
        id="bookmark-search-input"
        placeholder={TEXTS.placeholders.bookmarkSearch}
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onClear={handleClear}
      />
      <Button type="submit" className="h-10 px-6 rounded-xl font-bold md:hidden">
        {TEXTS.buttons.search}
      </Button>
    </form>
  );
}
