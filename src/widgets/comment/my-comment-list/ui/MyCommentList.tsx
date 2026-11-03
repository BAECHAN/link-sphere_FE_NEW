import { Loader2 } from 'lucide-react';
import { useMyCommentList } from '@/widgets/comment/my-comment-list/hooks/useMyCommentList';
import { MyCommentCard } from '@/widgets/comment/my-comment-list/ui/MyCommentCard';
import { MyCommentListSkeleton } from '@/widgets/comment/my-comment-list/ui/MyCommentCardSkeleton';
import { useRemoveErroredMyCommentsOnLeave } from '@/entities/comment/hooks/useRemoveErroredMyCommentsOnLeave';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
import { ErrorState } from '@/shared/ui/elements/ErrorState';
import { LoadMoreError } from '@/shared/ui/elements/LoadMoreError';
import { TEXTS } from '@/shared/config/texts';

export function MyCommentList() {
  // 에러 경계 밖에서 불러야 목록이 에러를 던진 채로 떠나도 정리가 돈다
  useRemoveErroredMyCommentsOnLeave();

  return (
    <AsyncBoundary
      loadingFallback={
        <DelayedFallback>
          <MyCommentListSkeleton />
        </DelayedFallback>
      }
      errorFallback={() => <ErrorState>{TEXTS.comment.myList.loadError}</ErrorState>}
    >
      <MyCommentListContent />
    </AsyncBoundary>
  );
}

function MyCommentListContent() {
  const {
    comments,
    hasNextPage,
    isFetchingNextPage,
    isNextPageFailed,
    retryNextPage,
    observerRef,
  } = useMyCommentList();

  if (comments.length === 0) {
    return (
      <EmptyState className="border rounded-lg bg-muted/10">
        {TEXTS.comment.myList.empty}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <MyCommentCard key={comment.id} comment={comment} />
      ))}

      {isNextPageFailed && <LoadMoreError onRetry={retryNextPage} />}
      {hasNextPage && !isNextPageFailed && (
        <div ref={observerRef} className="flex justify-center p-4">
          {isFetchingNextPage && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}
