import { describe, it, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';

describe('LinkThumbnail', () => {
  it('src가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = renderWithProviders(<LinkThumbnail src={null} alt="제목" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('src가 있으면 이미지를 렌더하고 no-referrer 정책을 붙인다', () => {
    const { getByRole } = renderWithProviders(
      <LinkThumbnail src="https://example.com/thumb.png" alt="제목" />
    );

    const img = getByRole('img', { name: '제목' });
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.png');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('이미지 로드에 실패해도 자리는 유지하고 안내 아이콘으로 대체한다', () => {
    // jsdom은 실제로 이미지를 로드하지 않아 onError가 자연 발화하지 않으므로 강제 트리거한다.
    // 자리를 통째로 없애면(과거 동작) 아래 콘텐츠가 밀려 올라와 레이아웃 시프트가
    // 생긴다(link-thumbnail.tsx 상단 주석 참고) — 그래서 컨테이너는 남기고 img만 교체한다.
    const { getByRole, container } = renderWithProviders(
      <LinkThumbnail src="https://example.com/broken.png" alt="제목" />
    );

    fireEvent.error(getByRole('img', { name: '제목' }));

    expect(container).not.toBeEmptyDOMElement();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('로드 실패 후 src가 바뀌면 에러 상태를 리셋하고 다시 렌더한다', () => {
    const { getByRole, rerender } = renderWithProviders(
      <LinkThumbnail src="https://example.com/broken.png" alt="제목" />
    );
    fireEvent.error(getByRole('img', { name: '제목' }));

    rerender(<LinkThumbnail src="https://example.com/new.png" alt="제목" />);

    expect(getByRole('img', { name: '제목' })).toHaveAttribute(
      'src',
      'https://example.com/new.png'
    );
  });
});
