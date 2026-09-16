import { useLayoutEffect, useRef, useState } from 'react';
import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { cn } from '@/shared/lib/tailwind/utils';

interface MobileCommentBarProps {
  postId: string;
}

// BottomTabBar(h-16 + safe-area)와 동일한 기준으로 그 위에 떠 있는다.
const TAB_BAR_RESERVE = 'calc(4rem + env(safe-area-inset-bottom))';
const TOAST_GAP_PX = 8;

export function MobileCommentBar({ postId }: MobileCommentBarProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 모바일 헤더 검색이 열리면 RecentSearchPanel(z-panel)이 화면을 덮는데 이 바도 같은
  // z층이라 DOM 순서만으로 패널 위에 남는다. 키는 Navbar.tsx:65-71이 인라인으로
  // push하는 것과 같아야 한다. 언마운트하지 않고 CSS로만 숨긴다 — 작성 중이던
  // 본문·첨부 이미지와 펼침 상태를 보존해야 한다(이탈 가드가 같은 pathname은 통과시킨다).
  const { isOpen: isMobileSearchOpen } = useHistoryOverlay('mobileSearchOpen');

  // 이 바가 떠 있는 동안 토스트가 그 위로 뜨도록 --toast-offset-bottom을 바 높이만큼
  // 키운다. 접힘/펼침에 따라 높이가 크게 달라지므로 ResizeObserver로 추적하고,
  // 언마운트 시에는 원래 값(globals.css의 미디어쿼리 값)으로 되돌린다.
  useLayoutEffect(
    function reserveToastSpaceAboveBar() {
      const node = containerRef.current;

      if (!node) {
        return;
      }

      // 검색 중엔 이 바가 hidden(display:none)이라 offsetHeight가 0이 된다 — 그대로
      // 측정하면 globals.css 기본값(탭바+0.75rem)과 4px 어긋난 값을 덮어쓰게 되므로,
      // 화면에 없는 것과 동일하게 기본값으로 되돌린다.
      if (isMobileSearchOpen) {
        document.documentElement.style.removeProperty('--toast-offset-bottom');
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
    [expanded, isMobileSearchOpen]
  );

  if (expanded) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'md:hidden fixed inset-x-0 bottom-0 z-scrim border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg',
          isMobileSearchOpen && 'hidden'
        )}
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
        onClick={() => setExpanded(true)}
      >
        {TEXTS.comment.form.mobileBarTrigger}
      </Button>
    </div>
  );
}
