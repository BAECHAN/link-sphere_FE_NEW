import { RefObject, useEffect, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';

interface ScrollToCommentFormButtonProps {
  targetRef: RefObject<HTMLDivElement>;
  /** 스크롤 직후 호출 - 보통 작성 폼 텍스트영역에 포커스를 준다 */
  onAfterScroll?: () => void;
}

/**
 * 데스크톱 전용 - 최상위 댓글 작성 폼이 스크롤로 화면 밖에 나가면 우측 하단에 떠서
 * 클릭 시 그 폼으로 스크롤해준다. ScrollToTop.tsx와 같은 자리(fixed bottom-6 right-6
 * z-50)를 쓰는데, 두 컴포넌트가 쓰이는 페이지가 겹치지 않아(ScrollToTop은 상세 페이지에서
 * 꺼짐) 충돌하지 않는다.
 */
export function ScrollToCommentFormButton({
  targetRef,
  onAfterScroll,
}: ScrollToCommentFormButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(
    function trackCommentFormVisibility() {
      const node = targetRef.current;

      if (!node) {
        return;
      }

      // Navbar(sticky top-0)에 가려진 상태도 "화면 밖"으로 친다. 하드코딩 대신
      // Navbar.tsx가 실측해 게시하는 --navbar-height를 읽어 항상 실제 높이와 맞춘다.
      const navbarHeight =
        getComputedStyle(document.documentElement).getPropertyValue('--navbar-height').trim() ||
        '64px';

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];

          if (entry) {
            setIsVisible(!entry.isIntersecting);
          }
        },
        { rootMargin: `-${navbarHeight} 0px 0px 0px` }
      );

      observer.observe(node);

      return () => observer.disconnect();
    },
    [targetRef]
  );

  function scrollToCommentForm() {
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // focus({ preventScroll: true })로 포커스하므로 스크롤 애니메이션이 끝나길
    // 기다리지 않고 바로 불러도 서로 간섭하지 않는다.
    onAfterScroll?.();
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            size="icon"
            onClick={scrollToCommentForm}
            className="rounded-full h-12 w-12 shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95"
            aria-label={TEXTS.ariaLabels.scrollToCommentForm}
          >
            <MessageSquarePlus className="h-6 w-6" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
