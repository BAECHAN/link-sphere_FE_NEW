import { useEffect, useLayoutEffect } from 'react';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';
import { useSuspenseFetchPostListQuery } from '@/entities/post/api/post.queries';
import { parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import { useWindowGridVirtualizer } from '@/shared/hooks/useWindowGridVirtualizer';
import { useHideBotsStore } from '@/shared/store/hideBots.store';
import { Post } from '@/entities/post/model/post.schema';
import {
  POST_GRID_COLUMNS,
  POST_GRID_ROW_GAP,
  POST_GRID_ROW_HEIGHT_ESTIMATE,
} from '@/widgets/post/post-list/config/post-grid.const';

const HIDE_BOTS_FILTER = 'excludeBots';

// 3열 기준 옛 IntersectionObserver rootMargin(3000px)과 체감이 비슷하도록 잡은 값
// (3000px ÷ 행 높이+간격 약 670px ≈ 4.5행)
const PREFETCH_ROW_LOOKAHEAD = 5;
const DEFAULT_ROW_HEIGHT = 600;

function getPostId(post: Post): string {
  return post.id;
}

/**
 * URL의 검색 파라미터(q, filter)와 이를 제어하는 액션들을 관리하는 훅
 * 데이터 페칭을 포함하지 않으므로 Suspense를 유발하지 않습니다.
 *
 * 봇 글 숨기기(excludeBots)는 URL이 아닌 localStorage 개인 설정(useHideBotsStore)으로
 * 관리하므로, 여기서 다루는 filter는 나머지 칩(북마크한/내가 작성한/비공개)만 대상으로 한다.
 */
export const usePostListParams = () => {
  const { searchParams, updateSearchParams, clearSearchParams } = useSearchParamsDraft();
  const q = searchParams.get('q') || '';
  const filter = searchParams.get('filter') || undefined;

  const { category, nickname, search } = parseSearchQuery(q);

  const setSearch = (newSearch: string) => {
    updateSearchParams((draft) => {
      if (!newSearch) {
        draft.delete('q');
      } else {
        draft.set('q', newSearch);
      }
    });
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
    setSearch,
    toggleFilter,
    clearSearch,
  };
};

/**
 * 게시글 목록 데이터와 무한 스크롤 로직을 포함하는 훅
 * useSuspenseFetchPostListQuery를 호출하므로 사용하는 컴포넌트가 Suspense에 의해 정지될 수 있습니다.
 */
export const usePostList = () => {
  const { category, nickname, search, currentFilter, ...params } = usePostListParams();
  const hideBots = useHideBotsStore((state) => state.hideBots);

  // URL filter(칩 3개)에 옛 북마크·공유 링크가 남긴 excludeBots가 섞여 있어도 무시하고,
  // 봇 숨기기 여부는 오직 localStorage 설정(useHideBotsStore)만 따른다
  const filters = (currentFilter ? currentFilter.split(',') : []).filter(
    (f) => f !== HIDE_BOTS_FILTER
  );
  if (hideBots) {
    filters.push(HIDE_BOTS_FILTER);
  }
  const combinedFilter = filters.length > 0 ? filters.join(',') : undefined;

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
      columnBreakpoints: POST_GRID_COLUMNS,
      gapBreakpoints: POST_GRID_ROW_GAP,
      estimateRowHeight: (count) => POST_GRID_ROW_HEIGHT_ESTIMATE[count] ?? DEFAULT_ROW_HEIGHT,
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
