import dayjs from 'dayjs';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CommentForm, CommentFormHandle } from '@/features/comment/create/ui/CommentForm';
import { MobileCommentBar } from '@/features/comment/create/ui/MobileCommentBar';
import { ScrollToCommentFormButton } from '@/features/comment/create/ui/ScrollToCommentFormButton';
import { CommentItem } from '@/widgets/comment/comment-list/ui/CommentItem';
import { Comment as PostComment } from '@/entities/comment/model/comment.schema';
import { useSuspenseComments } from '@/entities/comment/api/comment.queries';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
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
  const location = useLocation();
  const formContainerRef = useRef<HTMLDivElement>(null);
  const commentFormRef = useRef<CommentFormHandle>(null);
  const sorted = [...comments].sort(
    (a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()
  );
  const isEmpty = sorted.length === 0;
  const totalCount = countComments(comments);

  // "내 댓글" 목록 카드에서 원글로 넘어올 때(/post/:id#comment-:commentId) 그 댓글
  // 위치로 스크롤하고 잠시 링으로 강조한다 - 댓글이 많으면 목록 맨 위로만 가서는
  // "내가 어디 달았지"를 다시 찾아야 하는 문제를 해결한다. 답글(depth 1)도 같은
  // 트리에 함께 렌더되므로 이 효과 하나로 처리된다. block은 'center'가 아니라
  // 'start'를 쓴다 - 댓글이 길면 중앙 정렬 시 시작부가 뷰포트 위로 잘려 나가 이어서
  // 읽을 수 없다. scrollIntoView의 기본 동작 자체가 'start'다(MDN,
  // https://developer.mozilla.org/en/docs/Web/API/Element/scrollIntoView) - 네이티브
  // 앵커 링크(#id) 이동과 같은 "시작부를 위로" 정렬로 맞춘다. sticky navbar에 가려지지
  // 않도록 앵커 요소(CommentItem 루트)에 scroll-mt-(--navbar-height)를 함께 둔다(아래
  // CommentForm 컨테이너의 scroll-mt-(--navbar-height)와 동일 패턴).
  useEffect(
    function scrollToHashedComment() {
      if (!location.hash) {
        return;
      }
      const target = document.querySelector<HTMLElement>(location.hash);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add(
        'rounded-lg',
        'ring-2',
        'ring-primary',
        'ring-offset-2',
        'ring-offset-background'
      );
      const timer = setTimeout(() => {
        target.classList.remove(
          'rounded-lg',
          'ring-2',
          'ring-primary',
          'ring-offset-2',
          'ring-offset-background'
        );
      }, 1600);
      return () => clearTimeout(timer);
    },
    [location.hash]
  );

  return (
    <>
      <div className="space-y-6">
        <div className="scroll-mt-(--navbar-height)" ref={formContainerRef}>
          <h2 className="text-section-title">
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
            <EmptyState className="text-sm">{TEXTS.comment.list.empty}</EmptyState>
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
