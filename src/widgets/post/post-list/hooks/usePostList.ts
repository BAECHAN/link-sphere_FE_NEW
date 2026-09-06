import { useSearchParams } from 'react-router-dom';
import { useSuspenseFetchPostListQuery } from '@/entities/post/api/post.queries';
import { parseSearchQuery } from '@/widgets/post/post-list/utils/search-parser';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';
import { useHideBotsStore } from '@/shared/store/hideBots.store';

const HIDE_BOTS_FILTER = 'excludeBots';

/**
 * URL의 검색 파라미터(q, filter)와 이를 제어하는 액션들을 관리하는 훅
 * 데이터 페칭을 포함하지 않으므로 Suspense를 유발하지 않습니다.
 *
 * 봇 글 숨기기(excludeBots)는 URL이 아닌 localStorage 개인 설정(useHideBotsStore)으로
 * 관리하므로, 여기서 다루는 filter는 나머지 칩(북마크한/내가 작성한/비공개)만 대상으로 한다.
 */
export const usePostListParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const filter = searchParams.get('filter') || undefined;

  const { category, nickname, search } = parseSearchQuery(q);

  const setSearch = (newSearch: string) => {
    if (!newSearch) {
      searchParams.delete('q');
    } else {
      searchParams.set('q', newSearch);
    }
    setSearchParams(searchParams);
  };

  const toggleFilter = (targetFilter: string) => {
    const currentFilter = searchParams.get('filter') || '';
    const filters = currentFilter ? currentFilter.split(',') : [];

    let newFilters: string[];
    if (filters.includes(targetFilter)) {
      newFilters = filters.filter((f) => f !== targetFilter);
    } else {
      newFilters = [...filters, targetFilter];
    }

    if (newFilters.length === 0) {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', newFilters.join(','));
    }
    setSearchParams(searchParams);
  };

  const clearSearch = () => {
    setSearchParams({});
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

  const ref = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '0px 0px 3000px 0px',
  });

  const posts = data?.pages.flatMap((page) => page.content) || [];
  const correctedSearch = data?.pages[0]?.correctedSearch;

  return {
    posts,
    correctedSearch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
    observerRef: ref,
    currentFilter,
    ...params,
  };
};
