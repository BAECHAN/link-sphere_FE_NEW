import { useSuspenseMyCommentsInfiniteQuery } from '@/entities/comment/api/comment.queries';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';

/**
 * 내 댓글 목록 데이터와 무한 스크롤 로직을 포함하는 훅.
 * useSuspenseMyCommentsInfiniteQuery를 호출하므로 사용하는 컴포넌트가 Suspense에 의해 정지될 수 있다.
 */
export const useMyCommentList = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseMyCommentsInfiniteQuery();

  const observerRef = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '0px 0px 1200px 0px',
  });

  const comments = data?.comments ?? [];

  return { comments, hasNextPage, isFetchingNextPage, observerRef };
};
