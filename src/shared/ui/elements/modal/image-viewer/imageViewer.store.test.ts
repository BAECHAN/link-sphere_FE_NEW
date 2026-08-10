import { describe, it, expect, beforeEach } from 'vitest';
import { useImageViewerStore } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';

describe('useImageViewerStore', () => {
  beforeEach(() => {
    useImageViewerStore.setState({ images: [], currentIndex: 0 });
  });

  it('setImages로 배열과 시작 인덱스를 설정한다', () => {
    const images = [
      { src: 'a.png', alt: 'a' },
      { src: 'b.png', alt: 'b' },
      { src: 'c.png', alt: 'c' },
    ];

    useImageViewerStore.getState().setImages(images, 1);

    expect(useImageViewerStore.getState().images).toEqual(images);
    expect(useImageViewerStore.getState().currentIndex).toBe(1);
  });

  it('setImages의 시작 인덱스를 생략하면 0부터 시작한다', () => {
    useImageViewerStore.getState().setImages([{ src: 'a.png', alt: 'a' }]);

    expect(useImageViewerStore.getState().currentIndex).toBe(0);
  });

  it('next는 마지막 이미지에서 더 넘어가지 않는다', () => {
    const images = [
      { src: 'a.png', alt: 'a' },
      { src: 'b.png', alt: 'b' },
    ];
    useImageViewerStore.getState().setImages(images, 1);

    useImageViewerStore.getState().next();

    expect(useImageViewerStore.getState().currentIndex).toBe(1);
  });

  it('prev는 첫 이미지에서 더 앞으로 가지 않는다', () => {
    const images = [
      { src: 'a.png', alt: 'a' },
      { src: 'b.png', alt: 'b' },
    ];
    useImageViewerStore.getState().setImages(images, 0);

    useImageViewerStore.getState().prev();

    expect(useImageViewerStore.getState().currentIndex).toBe(0);
  });

  it('next/prev로 경계 안에서는 정상적으로 이동한다', () => {
    const images = [
      { src: 'a.png', alt: 'a' },
      { src: 'b.png', alt: 'b' },
      { src: 'c.png', alt: 'c' },
    ];
    useImageViewerStore.getState().setImages(images, 0);

    useImageViewerStore.getState().next();
    expect(useImageViewerStore.getState().currentIndex).toBe(1);

    useImageViewerStore.getState().next();
    expect(useImageViewerStore.getState().currentIndex).toBe(2);

    useImageViewerStore.getState().prev();
    expect(useImageViewerStore.getState().currentIndex).toBe(1);
  });

  it('setImage(단일)는 하위호환을 위해 이미지 1장짜리 갤러리로 취급한다', () => {
    useImageViewerStore.getState().setImage({ src: 'avatar.png', alt: '아바타' });

    expect(useImageViewerStore.getState().images).toEqual([{ src: 'avatar.png', alt: '아바타' }]);
    expect(useImageViewerStore.getState().currentIndex).toBe(0);
  });
});
