import dayjs from 'dayjs';
import { useRef } from 'react';
import { CommentForm, CommentFormHandle } from '@/features/comment/create/ui/CommentForm';
import { MobileCommentBar } from '@/features/comment/create/ui/MobileCommentBar';
import { ScrollToCommentFormButton } from '@/features/comment/create/ui/ScrollToCommentFormButton';
import { CommentItem } from '@/widgets/comment/comment-list/ui/CommentItem';
import { Comment as PostComment } from '@/entities/comment/model/comment.schema';
import { useSuspenseComments } from '@/entities/comment/api/comment.queries';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { TEXTS } from '@/shared/config/texts';

interface CommentListProps {
  postId: string;
  postAuthorId: string;
}

/** 답글까지 포함한 전체 댓글 수 — 삭제된 톰스톤도 세어야 PostCard의 commentCount와 일치한다. */
function countComments(comments: PostComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}

function CommentListContent({ postId, postAuthorId }: CommentListProps) {
  const { data: comments } = useSuspenseComments(postId);
  const isMobile = useIsMobile();
  const formContainerRef = useRef<HTMLDivElement>(null);
  const commentFormRef = useRef<CommentFormHandle>(null);
  const sorted = [...comments].sort(
    (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
  );
  const isEmpty = sorted.length === 0;
  const totalCount = countComments(comments);

  return (
    <div className="space-y-6">
      <div className="scroll-mt-(--navbar-height)" ref={formContainerRef}>
        <h2 className="text-lg font-semibold">
          {TEXTS.comment.list.heading}
          <span className="ml-1.5 text-muted-foreground">{totalCount}</span>
        </h2>
        {!isMobile && (
          <div className="mt-4 border-b pb-6">
            <CommentForm ref={commentFormRef} postId={postId} />
          </div>
        )}
      </div>

      <div className="space-y-6">
        {!isEmpty ? (
          sorted.map((comment: PostComment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              postAuthorId={postAuthorId}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {TEXTS.comment.list.empty}
          </div>
        )}
      </div>

      {isMobile && (
        <>
          {/* 하단 sticky 입력바에 가려지지 않도록 목록 끝에 여백을 둔다 */}
          <div className="h-16" aria-hidden />
          <MobileCommentBar postId={postId} />
        </>
      )}

      {!isMobile && (
        <ScrollToCommentFormButton
          targetRef={formContainerRef}
          onAfterScroll={() => commentFormRef.current?.focus()}
        />
      )}
    </div>
  );
}

export function CommentList({ postId, postAuthorId }: CommentListProps) {
  return (
    <AsyncBoundary>
      <CommentListContent postId={postId} postAuthorId={postAuthorId} />
    </AsyncBoundary>
  );
}
