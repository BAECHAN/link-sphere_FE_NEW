import { ImageViewer } from '@/shared/ui/elements/dialog/image-viewer/ImageViewer';
import { useImageViewerStore } from '@/shared/ui/elements/dialog/image-viewer/imageViewer.store';
import { useBackClosableOverlay } from '@/shared/hooks/useBackClosableOverlay';

/**
 * 이 앱의 이미지 확대 창 장착부 - 범용 `ImageViewer`에 스토어와 뒤로가기 오버레이 규약을 이어 준다(앱 전용).
 * RootLayout에 배치하여 사용합니다 (히스토리 훅이 라우터 컨텍스트를 필요로 함).
 */
export function GlobalImageViewer() {
  const images = useImageViewerStore((state) => state.images);
  const currentIndex = useImageViewerStore((state) => state.currentIndex);
  const next = useImageViewerStore((state) => state.next);
  const prev = useImageViewerStore((state) => state.prev);
  const { isOpen, close } = useBackClosableOverlay('imageViewerOpen');

  return (
    <ImageViewer
      open={isOpen}
      onClose={close}
      images={images}
      currentIndex={currentIndex}
      onNext={next}
      onPrev={prev}
    />
  );
}
