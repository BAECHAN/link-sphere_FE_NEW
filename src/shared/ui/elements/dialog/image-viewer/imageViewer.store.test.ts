import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  revokeObjectUrlsWhenUnused,
  useImageViewerStore,
} from '@/shared/ui/elements/dialog/image-viewer/imageViewer.store';

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

// 업로드 중인 댓글 이미지(blob:)를 확대 창으로 보는 동안 등록이 끝나도 화면이 깨지지 않아야 한다
describe('revokeObjectUrlsWhenUnused', () => {
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useImageViewerStore.setState({ images: [], currentIndex: 0 });
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('확대 창이 그 주소를 들고 있지 않으면 바로 해제한다', () => {
    useImageViewerStore.getState().setImages([{ src: 'https://cdn.example.com/a.png', alt: 'a' }]);

    revokeObjectUrlsWhenUnused(['blob:1', 'blob:2']);

    expect(revokeSpy).toHaveBeenCalledWith('blob:1');
    expect(revokeSpy).toHaveBeenCalledWith('blob:2');
  });

  it('확대 창이 들고 있으면 다른 이미지로 바뀔 때까지 해제를 미룬다', () => {
    useImageViewerStore.getState().setImages([
      { src: 'blob:1', alt: '1' },
      { src: 'blob:2', alt: '2' },
    ]);

    revokeObjectUrlsWhenUnused(['blob:1', 'blob:2']);
    useImageViewerStore.getState().next();

    expect(revokeSpy).not.toHaveBeenCalled();

    useImageViewerStore.getState().setImage({ src: 'https://cdn.example.com/b.png', alt: 'b' });

    expect(revokeSpy).toHaveBeenCalledWith('blob:1');
    expect(revokeSpy).toHaveBeenCalledWith('blob:2');
  });

  it('일부만 들고 있어도 함께 미룬다', () => {
    useImageViewerStore.getState().setImages([{ src: 'blob:2', alt: '2' }]);

    revokeObjectUrlsWhenUnused(['blob:1', 'blob:2']);

    expect(revokeSpy).not.toHaveBeenCalled();

    useImageViewerStore.getState().setImages([{ src: 'https://cdn.example.com/c.png', alt: 'c' }]);

    expect(revokeSpy).toHaveBeenCalledTimes(2);
  });
});
