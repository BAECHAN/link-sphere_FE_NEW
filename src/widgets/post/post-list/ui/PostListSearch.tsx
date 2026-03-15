import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { Button } from '@/shared/ui/atoms/button';
import { FilterChip } from '@/shared/ui/elements/FilterChip';
import { SearchInput } from '@/shared/ui/elements/SearchInput';
import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
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

  const activeFilters = currentFilter ? currentFilter.split(',') : [];
  const [optimisticFilters, setOptimisticFilters] = useState<string[]>(activeFilters);

  // transition 완료 후 URL과 동기화 (뒤로가기 등 외부 URL 변경 대응)
  useEffect(() => {
    setOptimisticFilters(currentFilter ? currentFilter.split(',') : []);
  }, [currentFilter]);

  const handleToggleFilter = (targetFilter: string) => {
    // flushSync로 강제 동기 커밋 → toggleFilter의 startTransition 배칭에서 분리
    flushSync(() => {
      setOptimisticFilters((prev) =>
        prev.includes(targetFilter)
          ? prev.filter((f) => f !== targetFilter)
          : [...prev, targetFilter]
      );
    });
    toggleFilter(targetFilter);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    clearSearch();
  };

  const isClickedBookmark = optimisticFilters.includes('isBookmarked');
  const isClickedMyPosts = optimisticFilters.includes('isMyPosts');
  const isClickedPrivate = optimisticFilters.includes('isPrivate');

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
              activeClassName="bg-warning text-warning-foreground hover:bg-warning hover:text-warning-foreground"
              onClick={() => handleToggleFilter('isBookmarked')}
            />

            <FilterChip
              label={TEXTS.buttons.myPosts}
              isActive={isClickedMyPosts}
              activeClassName="bg-info text-info-foreground hover:bg-info hover:text-info-foreground"
              onClick={() => handleToggleFilter('isMyPosts')}
            />

            <FilterChip
              label={TEXTS.buttons.privateOnly}
              isActive={isClickedPrivate}
              activeClassName="bg-category text-category-foreground hover:bg-category hover:text-category-foreground"
              onClick={() => handleToggleFilter('isPrivate')}
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
