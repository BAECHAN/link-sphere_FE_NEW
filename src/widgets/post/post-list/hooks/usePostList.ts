import { useDeferredValue, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';
import { useSuspenseFetchPostListQuery } from '@/entities/post/api/post.queries';
import { postRemoveQueries } from '@/entities/post/api/post.keys';
import { extractSearchTags, parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import {
  useWindowGridVirtualizer,
  type CardGridSpec,
} from '@/shared/hooks/useWindowGridVirtualizer';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { Post } from '@/entities/post/model/post.schema';

const HIDE_BOTS_FILTER = 'excludeBots';

// 3열 기준 옛 IntersectionObserver rootMargin(3000px)과 체감이 비슷하도록 잡은 값
// (3000px ÷ 행 높이+간격 약 670px ≈ 4.5행)
const PREFETCH_ROW_LOOKAHEAD = 5;
const DEFAULT_ROW_HEIGHT = 600;

function getPostId(post: Post): string {
  return post.id;
}

// URL filter(칩 4개)에 옛 북마크·공유 링크가 남긴 excludeBots가 섞여 있어도 무시하고,
// 봇 숨기기 여부는 오직 localStorage 설정(useHideBotsStore)만 따른다
function buildCombinedFilter(
  currentFilter: string | undefined,
  hideBots: boolean
): string | undefined {
  const filters = (currentFilter ? currentFilter.split(',') : []).filter(
    (f) => f !== HIDE_BOTS_FILTER
  );
  if (hideBots) {
    filters.push(HIDE_BOTS_FILTER);
  }
  return filters.length > 0 ? filters.join(',') : undefined;
}

/**
 * URL의 검색 파라미터(q, filter)와 이를 제어하는 액션들을 관리하는 훅
 * 데이터 페칭을 포함하지 않으므로 Suspense를 유발하지 않습니다.
 *
 * 봇 글 숨기기(excludeBots)는 URL이 아닌 localStorage 개인 설정(useHideBotsStore)으로
 * 관리하므로, 여기서 다루는 filter는 나머지 칩(북마크한/좋아요한/내가 작성한/비공개)만 대상으로 한다.
 */
export const usePostListParams = () => {
  const { searchParams, updateSearchParams, clearSearchParams } = useSearchParamsDraft();
  const q = searchParams.get('q') || '';
  const filter = searchParams.get('filter') || undefined;

  const { category, nickname, search } = parseSearchQuery(q);

  // 라벨(@카테고리) 칩 토글 - 기존 자유 검색어는 지우고 @카테고리/#닉네임 태그만 유지한다.
  // toggleFilter와 같은 이유로 커밋된 q가 아니라 draft(정지 구간의 pending 포함)의 q를 기준으로
  // 계산해야, 로딩 중에 라벨을 연달아 눌러도 먼저 누른 라벨이 덮어써지지 않는다. 칩 미러를
  // 맞출 수 있게 새 q를 돌려준다.
  const toggleSearchTag = (tag: string): string => {
    let nextSearch = '';

    updateSearchParams((draft) => {
      const tags = extractSearchTags(draft.get('q') || '');
      const nextTags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
      nextSearch = nextTags.join(' ');

      if (!nextSearch) {
        draft.delete('q');
      } else {
        draft.set('q', nextSearch);
      }
    });

    return nextSearch;
  };

  const toggleFilter = (targetFilter: string) => {
    updateSearchParams((draft) => {
      const currentFilter = draft.get('filter') || '';
      const filters = currentFilter ? currentFilter.split(',') : [];

      let newFilters: string[];
      if (filters.includes(targetFilter)) {
        newFilters = filters.filter((f) => f !== targetFilter);
      } else {
        newFilters = [...filters, targetFilter];
      }

      if (newFilters.length === 0) {
        draft.delete('filter');
      } else {
        draft.set('filter', newFilters.join(','));
      }
    });
  };

  const clearSearch = () => {
    clearSearchParams();
  };

  return {
    searchQuery: q,
    currentFilter: filter,
    category,
    nickname,
    search,
    toggleSearchTag,
    toggleFilter,
    clearSearch,
  };
};

/**
 * PostList 에러 경계에 넘길 리셋 조건. 목록 조회가 한 번 실패해도 검색 조건(q·filter·봇 숨기기)이
 * 바뀌면 에러 화면을 풀고 다시 조회한다 - 없으면 새로고침 전까지 에러 화면이 남는다.
 * 풀 때 실패한 목록 쿼리도 캐시에서 지운다 - 남겨 두면 나중에 그 조건을 다시 골랐을 때 요청 없이
 * 같은 에러가 바로 뜬다(postRemoveQueries.erroredLists 주석 참고).
 */
export const usePostListErrorReset = () => {
  const { searchQuery, currentFilter } = usePostListParams();
  const hideBots = useHideBotsStore((state) => state.hideBots);
  const queryClient = useQueryClient();

  const onReset = () => {
    postRemoveQueries.erroredLists(queryClient);
  };

  return { resetKeys: [searchQuery, currentFilter, hideBots], onReset };
};

/**
 * 봇 글 숨기기 설정(hideBots)과, 목록 조회에 실제로 쓰는 한 박자 늦춘 값(deferredHideBots).
 * store는 zustand(useSyncExternalStore)라 startTransition으로 감싸도 블로킹 갱신이 되고, 그 값으로 바로
 * 쿼리 키를 바꾸면 이미 보이던 목록이 Suspense fallback으로 숨겨진다
 * (https://react.dev/reference/react/useSyncExternalStore#caveats). 늦춘 값으로 조회하면 새 값의 렌더가
 * suspend하는 동안 React가 이전 목록을 그대로 둔다(https://react.dev/reference/react/useDeferredValue).
 */
function useDeferredHideBots() {
  const hideBots = useHideBotsStore((state) => state.hideBots);
  const deferredHideBots = useDeferredValue(hideBots);

  return { hideBots, deferredHideBots };
}

/**
 * 검색 조건을 바꾼 뒤 새 목록이 오기 전(정지 구간)인지. 라우터는 이미 새 위치에 가 있는데 React가
 * 보는(커밋된) 위치는 응답이 올 때까지 이전 그대로라, 둘의 쿼리가 다르면 "적용 중"이다. 같은 경로
 * 안에서만 본다 - 다른 페이지로 가는 이동은 곧 언마운트된다. 짧은 대기에서 깜빡이지 않도록
 * LOADING_INDICATOR_DELAY_MS가 지나야 true가 된다. 봇 글 숨기기는 URL을 바꾸지 않으므로 설정값과
 * 목록이 쓰는 늦춘 값이 다른지로 따로 본다.
 */
export const usePostListApplying = () => {
  const { pathname, search } = useLocation();
  const [latestLocation, setLatestLocation] = useState(() => RouterEvents.getLocation());
  const { hideBots, deferredHideBots } = useDeferredHideBots();

  // useSyncExternalStore로 읽지 않는다 - 정지 구간에 칩을 또 누르면 이 값이 transition 도중에 바뀌는데,
  // 그러면 React가 그 transition을 블로킹으로 다시 돌려 이전 목록 대신 스켈레톤이 뜰 수 있다
  // (https://react.dev/reference/react/useSyncExternalStore#caveats). 라우터 구독은 외부 이벤트라
  // effect 자리다(https://react.dev/learn/synchronizing-with-effects#subscribing-to-events).
  useEffect(() => RouterEvents.onNavigate(setLatestLocation), []);

  const isApplyingSearch =
    latestLocation !== null &&
    latestLocation.pathname === pathname &&
    latestLocation.search !== search;
  const isApplying = isApplyingSearch || hideBots !== deferredHideBots;

  return useDelayedLoading(isApplying, LOADING_INDICATOR_DELAY_MS);
};

/**
 * 게시글 목록 데이터와 무한 스크롤 로직을 포함하는 훅
 * useSuspenseFetchPostListQuery를 호출하므로 사용하는 컴포넌트가 Suspense에 의해 정지될 수 있습니다.
 * grid는 그리는 카드의 치수 - 카드를 넘기는 페이지가 함께 정한다(docs/FE-ARCHITECTURE.md §26).
 */
export const usePostList = (grid: CardGridSpec) => {
  const { category, nickname, search, currentFilter, ...params } = usePostListParams();
  const { deferredHideBots } = useDeferredHideBots();

  const combinedFilter = buildCombinedFilter(currentFilter, deferredHideBots);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useSuspenseFetchPostListQuery({
      search,
      category,
      nickname,
      filter: combinedFilter,
    });

  const posts = data.posts;
  const correctedSearch = data.pages[0]?.correctedSearch;

  const { containerRef, virtualizer, rows, columnCount, remeasureScrollMargin } =
    useWindowGridVirtualizer({
      listId: 'post-feed',
      items: posts,
      getItemId: getPostId,
      minColumnWidth: grid.minColumnWidth,
      maxColumns: grid.maxColumns,
      gapBreakpoints: grid.rowGap,
      estimateRowHeight: (count) => grid.rowHeightEstimate[count] ?? DEFAULT_ROW_HEIGHT,
    });

  // correctedSearch 안내 문구가 나타나거나 사라지면 컨테이너의 문서 상단 기준 위치가
  // 바뀌므로 scrollMargin을 다시 잰다 (pull-to-refresh 인디케이터처럼 매 프레임 바뀌는
  // 값은 여기 deps에 넣지 않는다 - 훅 내부에서 마운트·리사이즈 시에만 자동 재측정한다)
  useLayoutEffect(() => {
    remeasureScrollMargin();
  }, [correctedSearch, remeasureScrollMargin]);

  const lastVirtualRowIndex = virtualizer.getVirtualItems().at(-1)?.index;

  useEffect(() => {
    if (lastVirtualRowIndex === undefined) {
      return;
    }
    if (
      lastVirtualRowIndex >= rows.length - PREFETCH_ROW_LOOKAHEAD &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [lastVirtualRowIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    posts,
    correctedSearch,
    isFetchingNextPage,
    refetch,
    isRefetching,
    containerRef,
    virtualizer,
    rows,
    columnCount,
    currentFilter,
    ...params,
  };
};
