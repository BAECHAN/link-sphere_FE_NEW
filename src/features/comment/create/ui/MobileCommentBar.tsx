import { useLayoutEffect, useRef, useState } from 'react';
import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';

interface MobileCommentBarProps {
  postId: string;
}

// BottomTabBar(h-16 + safe-area)와 동일한 기준으로 그 위에 떠 있는다.
const TAB_BAR_RESERVE = 'calc(4rem + env(safe-area-inset-bottom))';
const TOAST_GAP_PX = 8;

export function MobileCommentBar({ postId }: MobileCommentBarProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 이 바가 떠 있는 동안 토스트가 그 위로 뜨도록 --toast-offset-bottom을 바 높이만큼
  // 키운다. 접힘/펼침에 따라 높이가 크게 달라지므로 ResizeObserver로 추적하고,
  // 언마운트 시에는 원래 값(globals.css의 미디어쿼리 값)으로 되돌린다.
  useLayoutEffect(
    function reserveToastSpaceAboveBar() {
      const node = containerRef.current;

      if (!node) {
        return;
      }

      function updateToastOffset() {
        const reserve = expanded ? '0px' : TAB_BAR_RESERVE;
        document.documentElement.style.setProperty(
          '--toast-offset-bottom',
          `calc(${reserve} + ${node!.offsetHeight + TOAST_GAP_PX}px)`
        );
      }

      updateToastOffset();

      const observer = new ResizeObserver(updateToastOffset);
      observer.observe(node);

      return () => {
        observer.disconnect();
        document.documentElement.style.removeProperty('--toast-offset-bottom');
      };
    },
    [expanded]
  );

  if (expanded) {
    return (
      <div
        ref={containerRef}
        className="md:hidden fixed inset-x-0 bottom-0 z-55 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg"
      >
        <CommentForm
          postId={postId}
          onCancel={() => setExpanded(false)}
          onSuccess={() => setExpanded(false)}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="md:hidden fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t bg-background px-4 py-2"
    >
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-start font-normal text-muted-foreground"
        aria-label={TEXTS.ariaLabels.commentBarExpand}
        onClick={() => setExpanded(true)}
      >
        {TEXTS.comment.form.mobileBarTrigger}
      </Button>
    </div>
  );
}
