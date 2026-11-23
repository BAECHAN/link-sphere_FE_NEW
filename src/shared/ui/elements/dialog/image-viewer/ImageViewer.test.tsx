import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { ImageViewer } from '@/shared/ui/elements/dialog/image-viewer/ImageViewer';
import { KO_UI_TEXTS } from '@baechan/ui/texts/ko-ui-texts';
import { UiTextsProvider } from '@baechan/ui/texts/UiTextsProvider';
import type { UiTexts } from '@baechan/ui/texts/ui-texts';

// 이 부품은 스토어와 라우터를 모른다 - 열림과 지금 보는 이미지를 속성으로만 받는다. 스토어·뒤로가기와 이은
// 동작은 GlobalImageViewer.test.tsx가 본다.

// 라벨이 부품에 적힌 글자가 아니라 Provider가 넘긴 글자인지 보려고 앱 문구와 다른 값을 넘긴다
const VIEWER_TEXTS: UiTexts = {
  ...KO_UI_TEXTS,
  common: { close: 'close-label' },
  imageViewer: {
    title: 'viewer-title',
    description: 'viewer-description',
    prev: 'prev-label',
    next: 'next-label',
  },
};

const IMAGES = [
  { src: 'https://example.com/a.png', alt: 'image-a' },
  { src: 'https://example.com/b.png', alt: 'image-b' },
  { src: 'https://example.com/c.png', alt: 'image-c' },
];

function renderViewer(props: Partial<ComponentProps<typeof ImageViewer>> = {}) {
  const handlers = { onClose: vi.fn(), onNext: vi.fn(), onPrev: vi.fn() };

  render(
    <UiTextsProvider texts={VIEWER_TEXTS}>
      <ImageViewer open images={IMAGES} currentIndex={1} {...handlers} {...props} />
    </UiTextsProvider>
  );

  return handlers;
}

// Dialog는 열린 직후의 클릭을 무시한다(dialog.test.tsx) - 그 시간을 넘긴 뒤에 누른다
function passOpenClickGuard() {
  vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
}

describe('ImageViewer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('open이 false면 창을 그리지 않는다', () => {
    renderViewer({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('열리면 지금 순서의 이미지와 Provider가 넘긴 제목·설명을 보여 준다', () => {
    renderViewer();

    const dialog = screen.getByRole('dialog', { name: 'viewer-title' });

    expect(dialog).toHaveAccessibleDescription('viewer-description');
    expect(screen.getByRole('img', { name: 'image-b' })).toHaveAttribute('src', IMAGES[1]?.src);
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 onClose를 한 번 부른다', () => {
    const { onClose } = renderViewer();
    passOpenClickGuard();

    fireEvent.click(screen.getByRole('button', { name: 'close-label' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('이미지 바깥의 창 바탕을 누르면 onClose를 부른다', () => {
    const { onClose } = renderViewer();
    passOpenClickGuard();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Escape를 누르면 onClose를 부른다', () => {
    const { onClose } = renderViewer();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('다음·이전 버튼은 onNext·onPrev만 부르고 창을 닫지 않는다', () => {
    const { onClose, onNext, onPrev } = renderViewer();
    passOpenClickGuard();

    fireEvent.click(screen.getByRole('button', { name: 'next-label' }));
    fireEvent.click(screen.getByRole('button', { name: 'prev-label' }));

    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('화살표 키로 onNext·onPrev를 부른다', () => {
    const { onNext, onPrev } = renderViewer();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('닫혀 있으면 화살표 키에 반응하지 않는다', () => {
    const { onNext, onPrev } = renderViewer({ open: false });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('첫 장에서는 이전 버튼이 비활성이다', () => {
    renderViewer({ currentIndex: 0 });

    expect(screen.getByRole('button', { name: 'prev-label' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'next-label' })).toBeEnabled();
  });

  it('마지막 장에서는 다음 버튼이 비활성이다', () => {
    renderViewer({ currentIndex: 2 });

    expect(screen.getByRole('button', { name: 'prev-label' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'next-label' })).toBeDisabled();
  });

  it('이미지가 한 장이면 이전·다음 버튼과 순서 표시가 없고 화살표 키에 반응하지 않는다', () => {
    const { onNext, onPrev } = renderViewer({ images: IMAGES.slice(0, 1), currentIndex: 0 });

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });

    expect(screen.queryByRole('button', { name: 'prev-label' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'next-label' })).toBeNull();
    expect(screen.queryByText('1 / 1')).toBeNull();
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });
});
