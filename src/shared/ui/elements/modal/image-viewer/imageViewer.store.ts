import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

export interface ImageViewerImage {
  src: string;
  alt: string;
}

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

/**
 * 이미지 뷰어(라이트박스)를 열기 위한 Hook
 * 열림 상태는 히스토리 엔트리로 관리되어(useHistoryOverlay), 뒤로가기로 자연스럽게 닫힌다.
 */
export function useImageViewer() {
  const setImage = useImageViewerStore((state) => state.setImage);
  const { open } = useHistoryOverlay('imageViewerOpen');

  return {
    openImageViewer: (image: ImageViewerImage) => {
      setImage(image);
      open();
    },
  };
}
