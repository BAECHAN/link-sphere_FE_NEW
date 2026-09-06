import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { Button } from '@/shared/ui/atoms/button';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { Switch } from '@/shared/ui/atoms/switch';
import { FilterChip } from '@/shared/ui/elements/FilterChip';
import { SearchInput } from '@/shared/ui/elements/SearchInput';
import { RotateCcw } from 'lucide-react';
import { startTransition, useEffect, useState, useTransition } from 'react';
import { flushSync } from 'react-dom';
import { usePostListParams } from '@/widgets/post/post-list/hooks/usePostList';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { TEXTS } from '@/shared/config/texts';

const SEARCH_LOADING_MIN_DURATION_MS = 400;

export function PostListSearch() {
  const { data: categories } = useFetchCategoryOptionQuery();
  const { searchQuery, currentFilter, setSearch, toggleFilter, clearSearch } = usePostListParams();
  const hideBots = useHideBotsStore((state) => state.hideBots);
  const setHideBots = useHideBotsStore((state) => state.setHideBots);
  const [isSearchPending, startSearchTransition] = useTransition();
  // 캐시 히트 등으로 전환이 순식간에 끝나도 "검색이 실행됐다"는 신호를 사람이 인지할 수 있게 최소 시간 보장
  const showSearchLoading = useMinimumLoading(isSearchPending, SEARCH_LOADING_MIN_DURATION_MS);

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

  // 봇 숨기기는 store(localStorage) 값이라 URL과 달리 라우터의 v7_startTransition 보호를
  // 받지 못한다. 그대로 두면 토글할 때마다 목록이 스켈레톤으로 떨어지므로, 스위치 자체는
  // flushSync로 즉시 반응시키고 실제 store 갱신(=재조회)만 startTransition으로 감싼다.
  const [optimisticHideBots, setOptimisticHideBots] = useState(hideBots);

  useEffect(() => {
    setOptimisticHideBots(hideBots);
  }, [hideBots]);

  const handleToggleHideBots = () => {
    const next = !optimisticHideBots;
    flushSync(() => {
      setOptimisticHideBots(next);
    });
    startTransition(() => {
      setHideBots(next);
    });
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // setSearch(setSearchParams)는 라우터의 v7_startTransition으로 이미 감싸여 있어
    // 검색 직후에도 결과가 도착할 때까지 화면이 조용히 그대로 유지된다.
    // 동일한 전환을 여기서도 시작해 isPending으로 버튼에 로딩 상태를 노출한다.
    startSearchTransition(() => {
      setSearch(searchInput);
    });
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
            <Button
              type="submit"
              disabled={showSearchLoading}
              className="h-10 px-6 rounded-xl  font-bold md:hidden"
            >
              {showSearchLoading ? <Spinner className="h-4 w-4" /> : TEXTS.buttons.search}
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
                    // 라벨 클릭 시 기존 자유 검색어는 초기화하고, 이미 선택된 @카테고리/#닉네임 태그만 유지한다.
                    const tag = `@${category.label}`;
                    const existingTags = searchInput.match(/[@#]\S+/g) ?? [];
                    const tagsWithoutSelf = existingTags.filter((t) => t !== tag);
                    const newTags = isSelected ? tagsWithoutSelf : [...tagsWithoutSelf, tag];
                    const newSearch = newTags.join(' ');

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

            <div className="h-4 w-px bg-border mx-2" />

            {/* 칩이 아니라 별도 스위치 - 나머지 필터(URL)와 달리 기기별 개인 설정이라
                localStorage(useHideBotsStore)에 영속화한다. 기본 OFF(봇 글 보임) */}
            <label
              htmlFor="hide-bots-switch"
              className="flex items-center gap-2 min-h-11 md:min-h-0 cursor-pointer select-none text-sm text-muted-foreground"
            >
              <span>{TEXTS.buttons.hideBots}</span>
              <Switch
                id="hide-bots-switch"
                checked={optimisticHideBots}
                onCheckedChange={handleToggleHideBots}
              />
            </label>

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
