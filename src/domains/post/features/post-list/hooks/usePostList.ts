import { useSearchParams } from 'react-router-dom';
import { useSuspenseFetchPostListQuery } from '@/domains/post/_common/api/post.queries';
import { parseSearchQuery } from '@/domains/post/features/post-list/utils/search-parser';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';

export const usePostList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  const filter = searchParams.get('filter') || undefined;

  const { category, search } = parseSearchQuery(q);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useSuspenseFetchPostListQuery({
    search,
    category,
    filter,
  });

  const ref = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    enabled: hasNextPage && !isFetchingNextPage,
  });

  // URL 업데이트 헬퍼 함수들
  const setSearch = (newSearch: string) => {
    // 빈 검색어면 q 파라미터 제거, 아니면 설정
    if (!newSearch) {
      searchParams.delete('q');
    } else {
      searchParams.set('q', newSearch);
    }
    // 검색 시 페이지 1로 초기화되는 것은 react-query key change로 자동 처리됨
    setSearchParams(searchParams);
  };

  const toggleFilter = (targetFilter: string) => {
    const currentFilter = searchParams.get('filter');

    if (currentFilter === targetFilter) {
      searchParams.delete('filter');
    } else {
      searchParams.set('filter', targetFilter);
    }

    setSearchParams(searchParams);
  };

  const clearSearch = () => {
    setSearchParams({});
  };

  const posts = data?.pages.flatMap((page) => page.content) || [];

  return {
    posts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    observerRef: ref,
    // Search State & Actions
    searchQuery: q,
    currentFilter: filter,
    setSearch,
    toggleFilter,
    clearSearch,
  };
};
