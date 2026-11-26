import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/atoms/dialog';
import { useUiTexts } from '@baechan/ui/texts/UiTextsProvider';
import { DURATION_MS } from '@baechan/ui/tokens';

// 인스타그램이 실제 공개한 기준값 - 이 범위 밖의 비율만 캔버스를 클램프한다(자르지 않고 object-contain).
const MIN_ASPECT_RATIO = 4 / 5; // 세로로 긴 한계
const MAX_ASPECT_RATIO = 1.91; // 가로로 긴 한계

function isJustClosedTransition(wasOpen: boolean, isOpen: boolean): boolean {
  return wasOpen && !isOpen;
}

export interface ImageViewerImage {
  src: string;
  alt: string;
}

interface ImageViewerProps {
  open: boolean;
  onClose: () => void;
  images: ImageViewerImage[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * 이미지 라이트박스(확대 뷰어). 열림과 지금 보는 이미지는 쓰는 쪽이 속성으로 넘긴다 - 스토어와 히스토리를
 * 모른다. 이 앱은 GlobalImageViewer.tsx가 스토어와 뒤로가기 오버레이 규약을 이어 준다.
 */
export function ImageViewer({
  open,
  onClose,
  images,
  currentIndex,
  onNext,
  onPrev,
}: ImageViewerProps) {
  const uiTexts = useUiTexts();
  const image = images[currentIndex] ?? null;
  const hasMultiple = images.length > 1;
  const hasNext = currentIndex < images.length - 1;
  const hasPrev = currentIndex > 0;

  // 비율은 그 비율을 잰 이미지 src와 함께 기억한다 - 이미지가 바뀌면(다음/이전) src가 달라
  // 자동으로 null이 되고 새 이미지의 onLoad를 다시 기다린다(effect로 리셋할 필요가 없다)
  const [loadedRatio, setLoadedRatio] = useState<{ src: string; ratio: number } | null>(null);
  const aspectRatio = loadedRatio && loadedRatio.src === image?.src ? loadedRatio.ratio : null;

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight, src } = e.currentTarget;
    const ratio = naturalWidth / naturalHeight;
    setLoadedRatio({
      src: image?.src ?? src,
      ratio: Math.min(Math.max(ratio, MIN_ASPECT_RATIO), MAX_ASPECT_RATIO),
    });
  }

  useEffect(
    function keyboardNavigationEffect() {
      if (!open || !hasMultiple) {
        return;
      }
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'ArrowRight') {
          onNext();
        } else if (e.key === 'ArrowLeft') {
          onPrev();
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    },
    [open, hasMultiple, onNext, onPrev]
  );

  const wasOpenRef = useRef(false);

  useEffect(
    function fixStaleCursorAfterClose() {
      const wasOpen = wasOpenRef.current;
      wasOpenRef.current = open;
      if (!isJustClosedTransition(wasOpen, open)) {
        return;
      }
      // Chromium 한정 버그: ESC처럼 마우스가 실제로 움직이지 않고 닫히면,
      // document.elementFromPoint()는 정확한 대상(원래 썸네일)을 돌려주는데
      // 브라우저 내부 :hover/커서 캐시만 갱신되지 않아 이전 커서 상태가 그대로
      // 남는다. 합성 mousemove dispatch나 강제 reflow는 이 캐시를 갱신하지
      // 못하고, body의 cursor 값을 실제로 바꿨다가 되돌리는 것만 효과가 있다.
      // (Playwright로 실제 컴포넌트에 대해 확인: Chromium만 재현되고, Firefox·
      // WebKit은 애초에 이 문제가 없으며 이 처리를 해도 부작용 없음)
      // Radix가 닫힘 애니메이션(duration-d4) 종료 시점에야 body pointer-events를
      // 복원하므로, 그보다 뒤에 실행해야 한다.
      const timeoutId = window.setTimeout(() => {
        document.body.style.cursor = 'none';
        void document.body.offsetHeight;
        document.body.style.cursor = '';
      }, DURATION_MS.d6);
      return () => window.clearTimeout(timeoutId);
    },
    [open]
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        onClick={onClose}
        className="flex h-[90vh] w-[90vw] max-w-none items-center justify-center gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none"
      >
        <DialogTitle className="sr-only">{uiTexts.imageViewer.title}</DialogTitle>
        <DialogDescription className="sr-only">{uiTexts.imageViewer.description}</DialogDescription>
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
                onPrev();
              }}
              className="fixed left-2 top-1/2 -translate-y-1/2 rounded-full bg-scrim/60 p-2 text-scrim-foreground transition-colors hover:bg-scrim/80 disabled:opacity-0"
            >
              <ChevronLeft className="size-5" />
              <span className="sr-only">{uiTexts.imageViewer.prev}</span>
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              className="fixed right-2 top-1/2 -translate-y-1/2 rounded-full bg-scrim/60 p-2 text-scrim-foreground transition-colors hover:bg-scrim/80 disabled:opacity-0"
            >
              <ChevronRight className="size-5" />
              <span className="sr-only">{uiTexts.imageViewer.next}</span>
            </button>
            <span className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-scrim/60 px-3 py-1 text-xs text-scrim-foreground">
              {currentIndex + 1} / {images.length}
            </span>
          </>
        )}
        <DialogClose
          className="fixed right-2 top-4 rounded-full bg-scrim/60 p-2 text-scrim-foreground transition-colors hover:bg-scrim/80"
          onClick={(e) => e.stopPropagation()}
        >
          <X className="size-5" />
          <span className="sr-only">{uiTexts.common.close}</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
