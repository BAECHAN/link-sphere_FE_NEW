import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

export interface ImageViewerImage {
  src: string;
  alt: string;
}

interface ImageViewerStore {
  image: ImageViewerImage | null;
  setImage: (image: ImageViewerImage) => void;
}

export const useImageViewerStore = create<ImageViewerStore>()(
  devtools(
    (set) => ({
      image: null,
      // image는 비우지 않는다 — 닫힘 애니메이션 도중 src가 사라져 깜빡이는 것을 방지 (열 때만 갱신)
      setImage: (image) => set({ image }),
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
