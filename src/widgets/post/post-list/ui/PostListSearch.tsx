import { useFetchCategoryOptionQuery } from '@/shared/api/common.queries';
import { Button } from '@/shared/ui/atoms/button';
import { Switch } from '@/shared/ui/atoms/switch';
import { FilterChip } from '@/shared/ui/elements/FilterChip';
import { RotateCcw } from 'lucide-react';
import { startTransition, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePostListParams } from '@/widgets/post/post-list/hooks/usePostList';
import { parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { TEXTS } from '@/shared/config/texts';

const SCOPE_FILTERS = ['isBookmarked', 'isMyPosts', 'isPrivate'] as const;

export function PostListSearch() {
  const { data: categories } = useFetchCategoryOptionQuery();
  const { searchQuery, currentFilter, setSearch, toggleFilter, clearSearch } = usePostListParams();
  const hideBots = useHideBotsStore((state) => state.hideBots);
  const setHideBots = useHideBotsStore((state) => state.setHideBots);

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

  // 카테고리 태그(@라벨)는 검색어(q) 안에 들어가는 값이라 URL(searchQuery)이 기준이다.
  // 검색창이 헤더로 이동하면서 로컬 미러가 사라졌으므로, 범위 필터 칩과 같은 이유로
  // (setSearch도 라우터 startTransition에 감싸여 있어 그대로 두면 칩이 늦게 반응한다)
  // 여기서도 flushSync 낙관적 미러를 둔다.
  const [optimisticCategoryTags, setOptimisticCategoryTags] = useState(
    () => parseSearchQuery(searchQuery).category ?? ''
  );

  useEffect(() => {
    setOptimisticCategoryTags(parseSearchQuery(searchQuery).category ?? '');
  }, [searchQuery]);

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

  const isClickedBookmark = optimisticFilters.includes('isBookmarked');
  const isClickedMyPosts = optimisticFilters.includes('isMyPosts');
  const isClickedPrivate = optimisticFilters.includes('isPrivate');

  // "조건 N개 적용 중" 카운트 — 봇 글 숨기기(localStorage 개인 설정, 초기화 대상 아님)는 제외.
  const selectedCategories = new Set(
    optimisticCategoryTags ? optimisticCategoryTags.split(',') : []
  );

  const { nickname: appliedNicknameTags, search: appliedKeyword } = parseSearchQuery(searchQuery);
  const appliedNicknameCount = appliedNicknameTags ? appliedNicknameTags.split(',').length : 0;
  const appliedScopeCount = SCOPE_FILTERS.filter((filter) =>
    optimisticFilters.includes(filter)
  ).length;
  const appliedCount =
    selectedCategories.size + appliedNicknameCount + appliedScopeCount + (appliedKeyword ? 1 : 0);

  return (
    <div className="flex flex-col gap-2 md:gap-3 p-5 md:p-6 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
      <div
        role="group"
        aria-label={TEXTS.ariaLabels.postCategoryFilters}
        className="flex flex-wrap gap-2"
      >
        {categories?.map((category) => {
          const isSelected = selectedCategories.has(category.label);
          return (
            <FilterChip
              key={category.value}
              id={`category-${category.value}`}
              name={category.value}
              label={`@${category.label}`}
              isActive={isSelected}
              activeClassName="bg-primary text-primary-foreground"
              onClick={() => {
                // 라벨 클릭 시 기존 자유 검색어는 초기화하고, 이미 선택된 @카테고리/#닉네임 태그만 유지한다.
                const tag = `@${category.label}`;
                const existingTags = searchQuery.match(/[@#]\S+/g) ?? [];
                const tagsWithoutSelf = existingTags.filter((t) => t !== tag);
                const newTags = isSelected ? tagsWithoutSelf : [...tagsWithoutSelf, tag];
                const newSearch = newTags.join(' ');

                flushSync(() => {
                  setOptimisticCategoryTags(parseSearchQuery(newSearch).category ?? '');
                });
                setSearch(newSearch);
              }}
            />
          );
        })}
      </div>

      <div
        role="group"
        aria-label={TEXTS.ariaLabels.postScopeFilters}
        className="flex flex-wrap gap-2"
      >
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
      </div>

      {/* 칩이 아니라 별도 스위치 - 나머지 필터(URL)와 달리 기기별 개인 설정이라
          localStorage(useHideBotsStore)에 영속화한다. 기본 OFF(봇 글 보임) */}
      <label
        htmlFor="hide-bots-switch"
        className="flex items-center justify-between min-h-11 md:min-h-0 cursor-pointer select-none text-sm text-muted-foreground"
      >
        <span>{TEXTS.buttons.hideBots}</span>
        <Switch
          id="hide-bots-switch"
          checked={optimisticHideBots}
          onCheckedChange={handleToggleHideBots}
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {appliedCount > 0 ? TEXTS.post.search.appliedCount(appliedCount) : ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSearch}
          disabled={appliedCount === 0}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
        >
          <RotateCcw className="h-3 w-3" />
          {TEXTS.buttons.reset}
        </Button>
      </div>
    </div>
  );
}
