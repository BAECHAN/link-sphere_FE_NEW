import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { Button } from '@/shared/ui/atoms/button';
import { FilterChip } from '@/shared/ui/elements/FilterChip';
import { SearchInput } from '@/shared/ui/elements/SearchInput';
import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePostListParams } from '@/widgets/post/post-list/hooks/usePostList';
import { TEXTS } from '@/shared/config/texts';

export function PostListSearch() {
  const { data: categories } = useFetchCategoryOptionQuery();
  const { searchQuery, currentFilter, setSearch, toggleFilter, clearSearch } = usePostListParams();

  const [searchInput, setSearchInput] = useState(searchQuery);

  // URL이 변경되면 로컬 상태도 동기화 (예: 뒤로가기)
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    clearSearch();
  };

  const activeFilters = currentFilter ? currentFilter.split(',') : [];
  const isClickedBookmark = activeFilters.includes('isBookmarked');
  const isClickedMyPosts = activeFilters.includes('isMyPosts');
  const isClickedPrivate = activeFilters.includes('isPrivate');

  return (
    <>
      <div className="flex flex-col gap-4 p-5 md:p-6 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 group">
            <SearchInput
              name="search-input"
              id="search-input"
              placeholder={TEXTS.placeholders.postSearch}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onClear={handleClear}
            />
            <Button type="submit" className="h-10 px-6 rounded-xl  font-bold md:hidden">
              {TEXTS.buttons.search}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {categories?.map((category) => {
              const isSelected = searchInput.includes(`@${category.label}`);
              return (
                <FilterChip
                  key={category.value}
                  id={`category-${category.value}`}
                  name={category.value}
                  label={category.label}
                  isActive={isSelected}
                  activeClassName="bg-primary text-primary-foreground"
                  onClick={() => {
                    let newSearch = searchInput;
                    const tag = `@${category.label}`;

                    if (isSelected) {
                      newSearch = newSearch.replace(tag, '').replace(/\s+/g, ' ').trim();
                    } else {
                      newSearch = `${newSearch} ${tag}`.trim();
                    }

                    setSearchInput(newSearch);
                    setSearch(newSearch);
                  }}
                />
              );
            })}

            <div className="h-4 w-px bg-border mx-2" />

            <FilterChip
              label={TEXTS.buttons.bookmarkOnly}
              isActive={isClickedBookmark}
              activeClassName="bg-warning text-warning-foreground"
              onClick={() => toggleFilter('isBookmarked')}
            />

            <FilterChip
              label={TEXTS.buttons.myPosts}
              isActive={isClickedMyPosts}
              activeClassName="bg-info text-info-foreground"
              onClick={() => toggleFilter('isMyPosts')}
            />

            <FilterChip
              label={TEXTS.buttons.privateOnly}
              isActive={isClickedPrivate}
              activeClassName="bg-category text-category-foreground"
              onClick={() => toggleFilter('isPrivate')}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              {TEXTS.buttons.reset}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
