import { useCategoryOptions } from '@/entities/category/hooks/useCategoryOptions';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { usePostListParams } from '@/widgets/post/post-list/hooks/usePostList';
import { parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import { SCOPE_FILTERS } from '@/widgets/post/post-list/utils/post-list-payload';
import { useAuthStore } from '@/shared/store/auth.store';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { RouterEvents } from '@/shared/lib/router/router-events';

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
 * URL 갱신은 라우터 startTransition에 감싸여 있어 칩 반응이 늦으므로,
 * flushSync로 즉시 반영하는 낙관적 미러를 따로 둔다(봇 숨기기 store는 갱신이 바로 반영돼 미러가 없다).
 */
export const usePostListFilter = () => {
  const { categoryOptionList } = useCategoryOptions();
  const { searchQuery, currentFilter, toggleSearchTag, toggleFilter, turnFilterOn, clearSearch } =
    usePostListParams();
  const { pathname } = useLocation();
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

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guard = useAuthGuard();

  // 로그인 뒤 재개는 칩을 누른 렌더가 아니라 로그인 창이 닫힌 뒤에 불린다 - 누를 때 잡아 둔 함수는 그때의
  // 위치에 묶여 있어, 재개가 쓴 주소 초안이 지금 위치의 것으로 남지 않는다(이어 누른 칩이 재개한 칩을 지운다).
  // 그래서 마지막으로 커밋된 turnFilterOn을 ref로 읽는다. ref는 렌더 중이 아니라 effect에서 갱신한다
  // (https://react.dev/reference/react/useRef#caveats)
  const latestTurnFilterOnRef = useRef(turnFilterOn);

  useEffect(() => {
    latestTurnFilterOnRef.current = turnFilterOn;
  });

  // 로그인 창 쪽 effect 안에서 불리므로 flushSync를 쓰지 않는다(렌더·effect 중의 flushSync는 React가 막는다)
  const turnFilterOnAfterLogin = (targetFilter: string) => {
    setOptimisticFilters((prev) => (prev.includes(targetFilter) ? prev : [...prev, targetFilter]));
    latestTurnFilterOnRef.current(targetFilter);
  };

  const handleToggleFilter = (targetFilter: string) => {
    const isTurningOn = !optimisticFilters.includes(targetFilter);

    // 범위 칩은 로그인해야 뜻이 있다 - 로그아웃 상태에서 켜려 하면 요청 없이 로그인 창을 띄우고, 로그인하면
    // 그 칩을 켠다. 끄는 데는 로그인이 필요 없다(칩을 켠 채 로그아웃한 뒤에도 끌 수 있어야 한다)
    if (isTurningOn && !isAuthenticated) {
      guard(() => turnFilterOnAfterLogin(targetFilter), { resumeAfterLogin: true });
      return;
    }

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
  // (toggleSearchTag도 라우터 startTransition에 감싸여 있어 그대로 두면 칩이 늦게 반응한다)
  // 여기서도 flushSync 낙관적 미러를 둔다.
  const [optimisticCategoryTags, setOptimisticCategoryTags] = useState(
    () => parseSearchQuery(searchQuery).category ?? ''
  );

  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);

  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setOptimisticCategoryTags(parseSearchQuery(searchQuery).category ?? '');
  }

  // 정지 구간에 뒤로/앞으로 가기를 하면 커밋 전의 원래 항목으로 돌아가 커밋된 URL 값이 끝내
  // 안 바뀐다 - 위 두 렌더 중 동기화가 돌지 않아 방금 누른 칩이 켜진 채 남는다. 라우터의 POP을
  // 직접 구독해 미러를 돌아간 URL로 맞춘다. 외부 이벤트 구독이라 effect 자리다
  // (https://react.dev/learn/synchronizing-with-effects#subscribing-to-events).
  useEffect(
    () =>
      RouterEvents.onPop((location) => {
        // 다른 페이지로 가는 POP이면 곧 언마운트된다 - 그 사이 칩이 꺼져 보이지 않게 둔다
        if (location.pathname !== pathname) {
          return;
        }

        const params = new URLSearchParams(location.search);
        const filter = params.get('filter');

        setOptimisticFilters(filter ? filter.split(',') : []);
        setOptimisticCategoryTags(parseSearchQuery(params.get('q') ?? '').category ?? '');
      }),
    [pathname]
  );

  // 봇 숨기기는 store(zustand) 값이라 갱신이 블로킹으로 바로 반영된다 - 스위치는 미러 없이 즉시
  // 반응하고, 목록이 이전 결과를 유지하는 건 usePostList가 늦춘 값(useDeferredValue)으로 조회해서다.
  // startTransition으로 감싸도 store 갱신은 transition이 되지 않는다(docs/SEARCH.md §10).
  const handleToggleHideBots = () => {
    setHideBots(!hideBots);
  };

  const isClickedBookmark = optimisticFilters.includes('isBookmarked');
  const isClickedLiked = optimisticFilters.includes('isLiked');
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
    // 새 q는 정지 구간의 pending까지 반영해 toggleSearchTag가 계산한다. 그 값을 받아야 해서
    // 범위 칩과 달리 URL 갱신이 먼저 나가지만, 미러는 flushSync라 transition과 섞이지 않고
    // 바로 반영된다.
    const nextSearch = toggleSearchTag(`@${category.label}`);

    flushSync(() => {
      setOptimisticCategoryTags(parseSearchQuery(nextSearch).category ?? '');
    });
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
    isClickedLiked,
    isClickedMyPosts,
    isClickedPrivate,
    handleToggleFilter,
    hideBots,
    handleToggleHideBots,
    appliedCount,
    handleClearSearch,
  };
};
