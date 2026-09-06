import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchInput } from '@/shared/ui/elements/SearchInput';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';

interface BookmarkSearchProps {
  className?: string;
}

export function BookmarkSearch({ className }: BookmarkSearchProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(searchQuery);

  // URL이 변경되면 로컬 상태도 동기화 (예: 뒤로가기)
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const applySearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      searchParams.set('q', trimmed);
    } else {
      searchParams.delete('q');
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    applySearch(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    applySearch('');
  };

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
