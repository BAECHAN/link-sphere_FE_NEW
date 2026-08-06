import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/atoms/dialog';
import { useImageViewerStore } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';
import { TEXTS } from '@/shared/config/texts';

/**
 * 전역 이미지 라이트박스(확대 뷰어)
 * App 최상위에 배치하여 사용합니다.
 */
export function GlobalImageViewer() {
  const { image, isOpen, close } = useImageViewerStore(
    useShallow((state) => ({ image: state.image, isOpen: state.isOpen, close: state.close }))
  );

  const wasOpenRef = useRef(false);

  useEffect(
    function fixStaleCursorAfterClose() {
      const wasOpen = wasOpenRef.current;
      wasOpenRef.current = isOpen;
      if (!wasOpen || isOpen) {
        return;
      }
      // Chromium 한정 버그: ESC처럼 마우스가 실제로 움직이지 않고 닫히면,
      // document.elementFromPoint()는 정확한 대상(원래 썸네일)을 돌려주는데
      // 브라우저 내부 :hover/커서 캐시만 갱신되지 않아 이전 커서 상태가 그대로
      // 남는다. 합성 mousemove dispatch나 강제 reflow는 이 캐시를 갱신하지
      // 못하고, body의 cursor 값을 실제로 바꿨다가 되돌리는 것만 효과가 있다.
      // (Playwright로 실제 컴포넌트에 대해 확인: Chromium만 재현되고, Firefox·
      // WebKit은 애초에 이 문제가 없으며 이 처리를 해도 부작용 없음)
      // Radix가 닫힘 애니메이션(duration-200) 종료 시점에야 body pointer-events를
      // 복원하므로, 그보다 뒤에 실행해야 한다.
      const timeoutId = window.setTimeout(() => {
        document.body.style.cursor = 'none';
        void document.body.offsetHeight;
        document.body.style.cursor = '';
      }, 300);
      return () => window.clearTimeout(timeoutId);
    },
    [isOpen]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        onClick={close}
        className="flex max-w-none w-auto items-center justify-center gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">{TEXTS.ariaLabels.imageViewer}</DialogTitle>
        <DialogDescription className="sr-only">
          {TEXTS.ariaLabels.imageViewerDescription}
        </DialogDescription>
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-[90vh] max-w-[95vw] cursor-default object-contain rounded-md"
          />
        )}
        <DialogClose
          className="fixed right-4 top-4 cursor-pointer rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          onClick={(e) => e.stopPropagation()}
        >
          <X className="size-5" />
          <span className="sr-only">{TEXTS.ariaLabels.close}</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
