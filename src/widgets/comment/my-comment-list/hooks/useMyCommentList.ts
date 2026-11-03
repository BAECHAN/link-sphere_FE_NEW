import { useSuspenseMyCommentsInfiniteQuery } from '@/entities/comment/api/comment.queries';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';

/**
 * 내 댓글 목록 데이터와 무한 스크롤 로직을 포함하는 훅.
 * useSuspenseMyCommentsInfiniteQuery를 호출하므로 사용하는 컴포넌트가 Suspense에 의해 정지될 수 있다.
 */
export const useMyCommentList = () => {
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, failureReason } =
    useSuspenseMyCommentsInfiniteQuery();

  // 실패하면 자동으로 다시 받지 않는다 - enabled가 돌아올 때마다 관찰자가 새로 생겨 센티넬이 보이는 즉시 다시
  // 불렀다. 재조회 중에도 기다린다(docs/POST.md 무한 스크롤)
  const canFetchNextPage = hasNextPage && !isFetching && !failureReason;
  const isNextPageFailed = hasNextPage && !isFetching && Boolean(failureReason);

  const observerRef = useIntersectionObserver({
    onIntersect: () => {
      if (canFetchNextPage) {
        fetchNextPage();
      }
    },
    enabled: canFetchNextPage,
    rootMargin: '0px 0px 1200px 0px',
  });

  const retryNextPage = () => {
    fetchNextPage();
  };

  const comments = data?.comments ?? [];

  return {
    comments,
    hasNextPage,
    isFetchingNextPage,
    isNextPageFailed,
    retryNextPage,
    observerRef,
  };
};
