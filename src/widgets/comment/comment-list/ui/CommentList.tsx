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
    <>
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

        {/* 하단 sticky 입력바에 가려지지 않도록 목록 끝에 여백을 둔다 */}
        {isMobile && <div className="h-16" aria-hidden />}
      </div>

      {/*
       * MobileCommentBar/ScrollToCommentFormButton은 둘 다 position: fixed라 화면에 보이는
       * 위치와 무관하지만, 위 space-y-6 형제로 두면 Tailwind의 :not(:last-child) 마진 규칙이
       * DOM 순서만으로 "마지막 자식"을 판단해 그 앞의 실제 콘텐츠(댓글 목록)에 24px 여백을
       * 붙였다 뗐다 한다. 이 컴포넌트들이 스크롤에 따라 마운트/언마운트될 때마다 문서 전체
       * 높이가 24px씩 흔들리고, 페이지 하단 근처에서는 브라우저가 스크롤 위치를 강제로
       * 보정하면서 화면이 살짝 밀리는 것처럼 보였다 — space-y-6 형제 목록 밖으로 분리해 제거.
       */}
      {isMobile && <MobileCommentBar postId={postId} />}

      {!isMobile && (
        <ScrollToCommentFormButton
          targetRef={formContainerRef}
          onAfterScroll={() => commentFormRef.current?.focus()}
        />
      )}
    </>
  );
}

export function CommentList({ postId, postAuthorId }: CommentListProps) {
  return (
    <AsyncBoundary>
      <CommentListContent postId={postId} postAuthorId={postAuthorId} />
    </AsyncBoundary>
  );
}
