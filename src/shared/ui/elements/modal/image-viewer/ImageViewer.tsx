import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/atoms/dialog';
import { useImageViewerStore } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { TEXTS } from '@/shared/config/texts';

// 인스타그램이 실제 공개한 기준값 - 이 범위 밖의 비율만 캔버스를 클램프한다(자르지 않고 object-contain).
const MIN_ASPECT_RATIO = 4 / 5; // 세로로 긴 한계
const MAX_ASPECT_RATIO = 1.91; // 가로로 긴 한계

/**
 * 전역 이미지 라이트박스(확대 뷰어)
 * RootLayout에 배치하여 사용합니다 (히스토리 훅이 라우터 컨텍스트를 필요로 함).
 */
export function GlobalImageViewer() {
  const images = useImageViewerStore((state) => state.images);
  const currentIndex = useImageViewerStore((state) => state.currentIndex);
  const next = useImageViewerStore((state) => state.next);
  const prev = useImageViewerStore((state) => state.prev);
  const { isOpen, close } = useHistoryOverlay('imageViewerOpen');
  const image = images[currentIndex] ?? null;
  const hasMultiple = images.length > 1;
  const hasNext = currentIndex < images.length - 1;
  const hasPrev = currentIndex > 0;

  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // 이미지가 바뀌면(다음/이전) 새 이미지의 onLoad를 다시 기다려야 한다.
  useEffect(() => {
    setAspectRatio(null);
  }, [image?.src]);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setAspectRatio(Math.min(Math.max(ratio, MIN_ASPECT_RATIO), MAX_ASPECT_RATIO));
  }

  useEffect(
    function keyboardNavigationEffect() {
      if (!isOpen || !hasMultiple) {
        return;
      }
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'ArrowRight') {
          next();
        } else if (e.key === 'ArrowLeft') {
          prev();
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    },
    [isOpen, hasMultiple, next, prev]
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
        className="flex h-[90vh] w-[90vw] max-w-none items-center justify-center gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">{TEXTS.ariaLabels.imageViewer}</DialogTitle>
        <DialogDescription className="sr-only">
          {TEXTS.ariaLabels.imageViewerDescription}
        </DialogDescription>
        {image && (
          <img
            src={image.src}
            alt={image.alt}
            onLoad={handleImageLoad}
            style={aspectRatio ? { aspectRatio } : undefined}
            className="max-h-[80vh] max-w-[80vw] cursor-default object-contain rounded-md"
          />
        )}
        {hasMultiple && (
          <>
            <button
              type="button"
              disabled={!hasPrev}
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="fixed left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 disabled:opacity-0"
            >
              <ChevronLeft className="size-5" />
              <span className="sr-only">{TEXTS.ariaLabels.imageViewerPrev}</span>
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="fixed right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 disabled:opacity-0"
            >
              <ChevronRight className="size-5" />
              <span className="sr-only">{TEXTS.ariaLabels.imageViewerNext}</span>
            </button>
            <span className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {currentIndex + 1} / {images.length}
            </span>
          </>
        )}
        <DialogClose
          className="fixed right-2 top-4 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
          onClick={(e) => e.stopPropagation()}
        >
          <X className="size-5" />
          <span className="sr-only">{TEXTS.ariaLabels.close}</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
