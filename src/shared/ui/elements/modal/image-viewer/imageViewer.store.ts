import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ImageViewerImage {
  src: string;
  alt: string;
}

interface ImageViewerStore {
  image: ImageViewerImage | null;
  isOpen: boolean;
  open: (image: ImageViewerImage) => void;
  close: () => void;
}

export const useImageViewerStore = create<ImageViewerStore>()(
  devtools(
    (set) => ({
      image: null,
      isOpen: false,
      open: (image) => set({ image, isOpen: true }),
      // image는 비우지 않는다 — 닫힘 애니메이션 도중 src가 사라져 깜빡이는 것을 방지
      close: () => set({ isOpen: false }),
    }),
    { name: 'image-viewer-store' }
  )
);

/**
 * 이미지 뷰어(라이트박스)를 열기 위한 Hook
 */
export function useImageViewer() {
  const open = useImageViewerStore((state) => state.open);

  return {
    openImageViewer: (image: ImageViewerImage) => open(image),
  };
}
