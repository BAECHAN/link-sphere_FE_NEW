import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { Button } from '@/shared/ui/atoms/button';
import { SearchInput } from '@/shared/ui/elements/SearchInput';
import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePostListParams } from '@/domains/post/features/post-list/hooks/usePostList';
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

  const isClickedBookmark = currentFilter === 'isBookmarked';

  return (
    <>
      <div className="flex flex-col gap-4 p-5 md:p-6 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2 group">
            <SearchInput
              name="search-input"
              id="search-input"
              placeholder="키워드나 @카테고리로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onClear={handleClear}
            />
            <Button type="submit" className="h-12 px-6 rounded-xl font-bold md:hidden">
              {TEXTS.buttons.search}
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            {categories?.map((category) => {
              const isSelected = searchInput.includes(`@${category.label}`);
              return (
                <button
                  key={category.value}
                  id={`category-${category.value}`}
                  name={category.value}
                  onClick={() => {
                    let newSearch = searchInput;
                    const tag = `@${category.label}`;

                    if (isSelected) {
                      newSearch = newSearch.replace(tag, '').replace(/\s+/g, ' ').trim();
                    } else {
                      newSearch = `${newSearch} ${tag}`.trim();
                    }

                    setSearchInput(newSearch);
                    setSearch(newSearch); // 카테고리 클릭 시 바로 검색 적용
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all transform active:scale-95 ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent'
                  }`}
                >
                  {category.label}
                </button>
              );
            })}

            <div className="h-4 w-[1px] bg-border mx-2" />

            <button
              onClick={() => toggleFilter('isBookmarked')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                isClickedBookmark
                  ? 'bg-yellow-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {TEXTS.buttons.bookmarkOnly}
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-red-500 gap-1"
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
