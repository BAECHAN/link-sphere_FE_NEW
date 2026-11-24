import { forwardRef, useState, type ForwardedRef } from 'react';
import { CommentFormView, type CommentFormHandle } from '@/features/comment/create/ui/CommentForm';
import { useCommentComposer } from '@/features/comment/create/hooks/useCommentComposer';
import { Button } from '@baechan/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@baechan/ui/lib/tailwind/utils';

interface CommentComposerProps {
  postId: string;
}

interface CommentComposerSessionProps extends CommentComposerProps {
  onDiscard: () => void;
}

/**
 * 펼친 시트의 높이 상한 — 입력칸이 내용만큼 끝없이 커져(field-sizing-content) 긴 글이면 시트가 화면 위로 넘쳤다.
 * 입력칸은 상한에서 멈추고 안에서 스크롤해 글자 수·등록 버튼이 늘 보이게 하고, 미리보기·첨부 이미지까지 길어지면
 * 시트 자체가 상한에서 안쪽 스크롤로 받는다. 시트 상한은 북마크 시트(SheetDialogContent)와 같은 70dvh다
 * (값과 근거: docs/COMMENT.md §5 "시트 높이"). 공용 CommentFormView는 넓은 화면 인라인·답글과 같이 쓰므로 여기서만 건다.
 */
const SHEET_MAX_HEIGHT = 'max-h-[70dvh] overflow-y-auto overscroll-contain';
const SHEET_TEXTAREA_MAX_HEIGHT = '[&_textarea]:max-h-[40dvh]';

/**
 * 한 번의 작성 세션. 넓은 화면에서는 제목 아래 인라인 폼, 좁은 화면에서는 접힌 바 또는 하단 시트로 그린다.
 * 폼을 감싸는 div는 두 배치에서 같은 자리의 같은 요소이고 클래스만 바뀐다 - 그래야 폭이 경계를 넘어도 React가
 * 폼을 새로 만들지 않아 입력칸의 글·커서·포커스가 이어진다(SheetDialogContent와 같은 방식.
 * https://react.dev/learn/preserving-and-resetting-state).
 */
const CommentComposerSession = forwardRef(function CommentComposerSession(
  { postId, onDiscard }: CommentComposerSessionProps,
  ref: ForwardedRef<CommentFormHandle>
) {
  const { draft, isMobile, isSheetOpen, isMobileSearchOpen, floatingRef, expand } =
    useCommentComposer(postId);

  return (
    <>
      {(!isMobile || isSheetOpen) && (
        <div
          ref={floatingRef}
          className={cn(
            isMobile
              ? [
                  // md:hidden을 붙이지 않는다 - 넓어진 것을 CSS는 바로 알고 React(useIsMobile)는 한 박자 늦게 알아,
                  // 그사이 시트가 숨으면 브라우저가 입력칸의 포커스를 뺀다. 어느 배치로 그릴지는 isMobile 하나만 정한다
                  'fixed inset-x-0 bottom-0 z-scrim border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg',
                  SHEET_MAX_HEIGHT,
                  SHEET_TEXTAREA_MAX_HEIGHT,
                  isMobileSearchOpen && 'hidden',
                ]
              : 'mt-4'
          )}
        >
          {/* 바깥에서 주는 포커스(#comments)는 넓은 화면 인라인 폼만 받는다 - 좁은 화면은 전부터 받지 않았다 */}
          <CommentFormView
            ref={isMobile ? undefined : ref}
            postId={postId}
            draft={draft}
            onCancel={isMobile ? onDiscard : undefined}
          />
        </div>
      )}
      {isMobile && !isSheetOpen && (
        <div
          ref={floatingRef}
          className={cn(
            'md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-panel border-t bg-background px-4 py-2',
            isMobileSearchOpen && 'hidden'
          )}
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full justify-start font-normal text-muted-foreground"
            aria-label={TEXTS.ariaLabels.commentBarExpand}
            onClick={expand}
          >
            {TEXTS.comment.form.mobileBarTrigger}
          </Button>
        </div>
      )}
    </>
  );
});

CommentComposerSession.displayName = 'CommentComposerSession';

/**
 * 글 상세의 최상위 댓글 작성 칸. 화면 폭과 상관없이 댓글 목록의 한 자리에 그린다(CommentList).
 * 답글처럼 열렸다 닫히는 폼은 CommentForm을 쓴다.
 */
export const CommentComposer = forwardRef(function CommentComposer(
  { postId }: CommentComposerProps,
  ref: ForwardedRef<CommentFormHandle>
) {
  // 좁은 화면 시트의 "취소"는 쓰던 글을 버리고 접는다. 세션을 새 key로 다시 시작해 글·첨부·실패 안내·펼침을
  // 한꺼번에 비운다 - 요청이 돌던 중이었다면 그 실패는 닫힌 폼의 것이라 토스트로 간다(useHasLeftPage)
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <CommentComposerSession
      key={sessionKey}
      ref={ref}
      postId={postId}
      onDiscard={() => setSessionKey((key) => key + 1)}
    />
  );
});

CommentComposer.displayName = 'CommentComposer';
