import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useBackClosableOverlayOpen } from '@/shared/hooks/useBackClosableOverlay';
import type { ImageViewerImage } from '@/shared/ui/elements/dialog/image-viewer/ImageViewer';

interface ImageViewerStore {
  images: ImageViewerImage[];
  currentIndex: number;
  setImages: (images: ImageViewerImage[], startIndex?: number) => void;
  setImage: (image: ImageViewerImage) => void;
  next: () => void;
  prev: () => void;
}

export const useImageViewerStore = create<ImageViewerStore>()(
  devtools(
    (set, get) => ({
      images: [],
      currentIndex: 0,
      // images는 비우지 않는다 — 닫힘 애니메이션 도중 src가 사라져 깜빡이는 것을 방지 (열 때만 갱신)
      setImages: (images, startIndex = 0) => set({ images, currentIndex: startIndex }),
      // 단일 이미지 호출부(아바타 확대 등)를 위한 얇은 래퍼 - 갤러리 1장짜리와 동일하게 처리된다.
      setImage: (image) => set({ images: [image], currentIndex: 0 }),
      next: () => {
        const { images, currentIndex } = get();
        if (currentIndex < images.length - 1) {
          set({ currentIndex: currentIndex + 1 });
        }
      },
      prev: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1 });
        }
      },
    }),
    { name: 'image-viewer-store' }
  )
);

function holdsAnyOf(images: ImageViewerImage[], urls: string[]): boolean {
  return images.some((image) => urls.includes(image.src));
}

/**
 * 임시 주소(`blob:`)를 해제한다. 확대 창이 그중 하나라도 들고 있으면 다른 이미지로 바뀔 때까지 미룬다 -
 * 업로드 중인 댓글 이미지를 확대해 보는 동안 등록이 끝나도, 해제된 주소를 새로 읽다 깨지지 않게 한다.
 * 스토어는 닫혀도 images를 비우지 않으므로 해제는 다음에 다른 이미지로 확대 창을 열 때 일어난다.
 */
export function revokeObjectUrlsWhenUnused(urls: string[]) {
  const revokeAll = () => urls.forEach((url) => URL.revokeObjectURL(url));

  if (!holdsAnyOf(useImageViewerStore.getState().images, urls)) {
    revokeAll();
    return;
  }

  const unsubscribe = useImageViewerStore.subscribe((state) => {
    if (holdsAnyOf(state.images, urls)) {
      return;
    }

    unsubscribe();
    revokeAll();
  });
}

/**
 * 이미지 뷰어(라이트박스)를 열기 위한 Hook
 * 열림 상태는 히스토리 엔트리로 관리되어(useBackClosableOverlay), 뒤로가기로 자연스럽게 닫힌다.
 */
export function useImageViewer() {
  const setImage = useImageViewerStore((state) => state.setImage);
  const open = useBackClosableOverlayOpen('imageViewerOpen');

  return {
    openImageViewer: (image: ImageViewerImage) => {
      setImage(image);
      open();
    },
  };
}
