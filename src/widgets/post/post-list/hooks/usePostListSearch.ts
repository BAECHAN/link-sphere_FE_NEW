import { useCategoryOptions } from '@/entities/category/hooks/useCategoryOptions';
import { startTransition, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePostListParams } from '@/widgets/post/post-list/hooks/usePostList';
import { extractSearchTags, parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import { useHideBotsStore } from '@/shared/store/hideBots.store';

const SCOPE_FILTERS = ['isBookmarked', 'isMyPosts', 'isPrivate'] as const;

// "조건 N개 적용 중" 카운트 — 봇 글 숨기기(localStorage 개인 설정, 초기화 대상 아님)는 제외.
function computeAppliedFilterCount(
  searchQuery: string,
  optimisticCategoryTags: string,
  optimisticFilters: string[]
): number {
  const selectedCategoryCount = new Set(
    optimisticCategoryTags ? optimisticCategoryTags.split(',') : []
  ).size;
  const { nickname: appliedNicknameTags, search: appliedKeyword } = parseSearchQuery(searchQuery);
  const appliedNicknameCount = appliedNicknameTags ? appliedNicknameTags.split(',').length : 0;
  const appliedScopeCount = SCOPE_FILTERS.filter((filter) =>
    optimisticFilters.includes(filter)
  ).length;

  return (
    selectedCategoryCount + appliedNicknameCount + appliedScopeCount + (appliedKeyword ? 1 : 0)
  );
}

/**
 * 목록 검색 카드(카테고리·범위 필터·봇 숨기기)의 낙관적 상태와 핸들러를 포함하는 훅.
 * URL/store 갱신은 라우터 startTransition에 감싸여 있어 칩 반응이 늦으므로,
 * flushSync로 즉시 반영하는 낙관적 미러를 따로 둔다.
 */
export const usePostListSearch = () => {
  const { categoryOptionList } = useCategoryOptions();
  const { searchQuery, currentFilter, setSearch, toggleFilter, clearSearch } = usePostListParams();
  const hideBots = useHideBotsStore((state) => state.hideBots);
  const setHideBots = useHideBotsStore((state) => state.setHideBots);

  const activeFilters = currentFilter ? currentFilter.split(',') : [];
  const [optimisticFilters, setOptimisticFilters] = useState<string[]>(activeFilters);
  const [prevCurrentFilter, setPrevCurrentFilter] = useState(currentFilter);

  // transition 완료 후 URL과 동기화 (뒤로가기 등 외부 URL 변경 대응). 아래 두 미러도 같은
  // 방식으로, effect가 아니라 렌더 중에 맞춘다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (currentFilter !== prevCurrentFilter) {
    setPrevCurrentFilter(currentFilter);
    setOptimisticFilters(activeFilters);
  }

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

  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);

  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setOptimisticCategoryTags(parseSearchQuery(searchQuery).category ?? '');
  }

  // 봇 숨기기는 store(localStorage) 값이라 URL과 달리 라우터의 v7_startTransition 보호를
  // 받지 못한다. 그대로 두면 토글할 때마다 목록이 스켈레톤으로 떨어지므로, 스위치 자체는
  // flushSync로 즉시 반응시키고 실제 store 갱신(=재조회)만 startTransition으로 감싼다.
  const [optimisticHideBots, setOptimisticHideBots] = useState(hideBots);
  const [prevHideBots, setPrevHideBots] = useState(hideBots);

  if (hideBots !== prevHideBots) {
    setPrevHideBots(hideBots);
    setOptimisticHideBots(hideBots);
  }

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

  const selectedCategories = new Set(
    optimisticCategoryTags ? optimisticCategoryTags.split(',') : []
  );

  const appliedCount = computeAppliedFilterCount(
    searchQuery,
    optimisticCategoryTags,
    optimisticFilters
  );

  const toggleCategoryTagInSearch = (category: (typeof categoryOptionList)[number]) => {
    // 라벨 클릭 시 기존 자유 검색어는 초기화하고, 이미 선택된 @카테고리/#닉네임 태그만 유지한다.
    const tag = `@${category.label}`;
    const isSelected = selectedCategories.has(category.label);
    const existingTags = extractSearchTags(searchQuery);
    const tagsWithoutSelf = existingTags.filter((t) => t !== tag);
    const newTags = isSelected ? tagsWithoutSelf : [...tagsWithoutSelf, tag];
    const newSearch = newTags.join(' ');

    flushSync(() => {
      setOptimisticCategoryTags(parseSearchQuery(newSearch).category ?? '');
    });
    setSearch(newSearch);
  };

  const handleClearSearch = () => {
    // 적용된 조건이 없으면 아무것도 하지 않는다 — clearSearch는 replace 없이
    // setSearchParams를 호출하므로 같은 URL로 history entry만 쌓인다.
    if (appliedCount === 0) {
      return;
    }
    clearSearch();
  };

  return {
    categoryOptionList,
    selectedCategories,
    toggleCategoryTagInSearch,
    isClickedBookmark,
    isClickedMyPosts,
    isClickedPrivate,
    handleToggleFilter,
    optimisticHideBots,
    handleToggleHideBots,
    appliedCount,
    handleClearSearch,
  };
};
