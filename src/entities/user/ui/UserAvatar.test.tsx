import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';

// Radix Avatar는 new window.Image()로 로딩 상태를 판정한다 - jsdom은 이미지를 실제로 받지 않으므로
// 생성된 Image를 붙잡아 두고 error 이벤트를 직접 발생시켜 로드 실패를 재현한다.
const createdImages: HTMLImageElement[] = [];
const OriginalImage = window.Image;

beforeEach(() => {
  createdImages.length = 0;
  vi.spyOn(window, 'Image').mockImplementation(function ImageMock() {
    const image = new OriginalImage();
    createdImages.push(image);
    return image;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function failLastImage() {
  act(() => {
    createdImages.at(-1)?.dispatchEvent(new Event('error'));
  });
}

describe('UserAvatar', () => {
  it('이미지 로드에 실패하면 이니셜로 대체하고 확대 버튼을 없앤다', () => {
    renderWithProviders(<UserAvatar image="https://example.com/a.png" nickname="링크" zoomable />);

    expect(screen.getByRole('button', { name: TEXTS.ariaLabels.profileImageZoom })).toBeVisible();

    failLastImage();

    expect(screen.getByText('링')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: TEXTS.ariaLabels.profileImageZoom })
    ).not.toBeInTheDocument();
  });

  it('실패 뒤 이미지 주소가 바뀌면 이전 실패를 들고 있지 않고 다시 시도한다', () => {
    const { rerender } = renderWithProviders(
      <UserAvatar image="https://example.com/a.png" nickname="링크" zoomable />
    );
    failLastImage();

    rerender(<UserAvatar image="https://example.com/b.png" nickname="링크" zoomable />);

    expect(screen.getByRole('button', { name: TEXTS.ariaLabels.profileImageZoom })).toBeVisible();
  });
});
