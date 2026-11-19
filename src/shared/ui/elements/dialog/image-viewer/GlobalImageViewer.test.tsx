import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, renderWithDataRouter, screen, waitFor } from '@/test/utils';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { useBackClosableOverlayOpen } from '@/shared/hooks/useBackClosableOverlay';
import { GlobalImageViewer } from '@/shared/ui/elements/dialog/image-viewer/GlobalImageViewer';
import { useImageViewerStore } from '@/shared/ui/elements/dialog/image-viewer/imageViewer.store';

// 스토어와 뒤로가기 오버레이 규약을 ImageViewer에 잇는 배선만 본다. 창이 그리는 것은 ImageViewer.test.tsx가,
// 실제 브라우저의 뒤로가기는 e2e/back-closable-overlay.spec.ts가 본다.

const IMAGES = [
  { src: 'https://example.com/a.png', alt: 'image-a' },
  { src: 'https://example.com/b.png', alt: 'image-b' },
  { src: 'https://example.com/c.png', alt: 'image-c' },
];

// 본문·댓글 이미지(MarkdownContent)처럼 스토어에 이미지를 넣고 오버레이 칸을 연다
function Host() {
  const setImages = useImageViewerStore((state) => state.setImages);
  const open = useBackClosableOverlayOpen('imageViewerOpen');

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setImages(IMAGES, 0);
          open();
        }}
      >
        open
      </button>
      <GlobalImageViewer />
    </>
  );
}

async function openViewer() {
  fireEvent.click(screen.getByRole('button', { name: 'open' }));
  await screen.findByRole('dialog', { name: TEXTS.ariaLabels.imageViewer });
  // Dialog는 열린 직후의 클릭을 무시한다(dialog.test.tsx)
  vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
}

describe('GlobalImageViewer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    useImageViewerStore.setState({ images: [], currentIndex: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('오버레이 칸이 열리면 스토어의 이미지를 보여 주고, 다음·이전이 스토어의 순서를 바꾼다', async () => {
    renderWithDataRouter(<Host />);

    await openViewer();
    expect(screen.getByRole('img', { name: 'image-a' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: TEXTS.ariaLabels.imageViewerNext }));
    expect(useImageViewerStore.getState().currentIndex).toBe(1);
    expect(screen.getByRole('img', { name: 'image-b' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: TEXTS.ariaLabels.imageViewerPrev }));
    expect(useImageViewerStore.getState().currentIndex).toBe(0);
    expect(screen.getByRole('img', { name: 'image-a' })).toBeInTheDocument();
  });

  it('닫기 버튼을 누르면 오버레이 칸을 빼서 닫는다', async () => {
    const { router } = renderWithDataRouter(<Host />);

    await openViewer();
    expect(router.state.location.state).toEqual({ imageViewerOpen: true });

    fireEvent.click(screen.getByRole('button', { name: TEXTS.ariaLabels.close }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.state).toBeNull();
  });

  it('뒤로가기로 칸이 빠지면 닫힌다', async () => {
    const { router } = renderWithDataRouter(<Host />);

    await openViewer();

    await act(() => router.navigate(-1));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
