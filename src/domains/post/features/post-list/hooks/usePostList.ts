import { useSearchParams } from 'react-router-dom';
import { useSuspenseFetchPostListQuery } from '@/domains/post/_common/api/post.queries';
import { parseSearchQuery } from '@/domains/post/features/post-list/utils/search-parser';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';

/**
 * URL의 검색 파라미터(q, filter)와 이를 제어하는 액션들을 관리하는 훅
 * 데이터 페칭을 포함하지 않으므로 Suspense를 유발하지 않습니다.
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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseFetchPostListQuery({
    search,
    category,
    nickname,
    filter: currentFilter,
  });

  const ref = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '0px 0px 600px 0px',
  });

  const posts = data?.pages.flatMap((page) => page.content) || [];

  return {
    posts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    observerRef: ref,
    currentFilter,
    ...params,
  };
};
