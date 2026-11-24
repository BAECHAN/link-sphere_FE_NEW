import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { LinkThumbnail } from '@baechan/ui/atoms/link-thumbnail';

describe('LinkThumbnail', () => {
  it('src가 없으면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<LinkThumbnail src={null} alt="제목" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('src가 있으면 이미지를 렌더하고 no-referrer 정책을 붙인다', () => {
    const { getByRole } = render(<LinkThumbnail src="https://example.com/thumb.png" alt="제목" />);

    const img = getByRole('img', { name: '제목' });
    expect(img).toHaveAttribute('src', 'https://example.com/thumb.png');
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('기본값은 lazy 로딩이다', () => {
    const { getByRole } = render(<LinkThumbnail src="https://example.com/thumb.png" alt="제목" />);

    expect(getByRole('img', { name: '제목' })).toHaveAttribute('loading', 'lazy');
  });

  it('priority가 true면 eager 로딩과 높은 fetchPriority를 쓴다', () => {
    const { getByRole } = render(
      <LinkThumbnail src="https://example.com/thumb.png" alt="제목" priority />
    );

    const img = getByRole('img', { name: '제목' });
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('이미지 로드에 실패해도 자리는 유지하고 안내 아이콘으로 대체한다', () => {
    // jsdom은 실제로 이미지를 로드하지 않아 onError가 자연 발화하지 않으므로 강제 트리거한다.
    // 자리를 통째로 없애면(과거 동작) 아래 콘텐츠가 밀려 올라와 레이아웃 시프트가
    // 생긴다(link-thumbnail.tsx 상단 주석 참고) — 그래서 컨테이너는 남기고 img만 교체한다.
    const { getByRole, container } = render(
      <LinkThumbnail src="https://example.com/broken.png" alt="제목" />
    );

    fireEvent.error(getByRole('img', { name: '제목' }));

    expect(container).not.toBeEmptyDOMElement();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('로드 실패 후 src가 바뀌면 에러 상태를 리셋하고 다시 렌더한다', () => {
    const { getByRole, rerender } = render(
      <LinkThumbnail src="https://example.com/broken.png" alt="제목" />
    );
    fireEvent.error(getByRole('img', { name: '제목' }));

    rerender(<LinkThumbnail src="https://example.com/new.png" alt="제목" />);

    expect(getByRole('img', { name: '제목' })).toHaveAttribute(
      'src',
      'https://example.com/new.png'
    );
  });

  it('같은 src가 두 번 실패하면 재마운트 시 img를 아예 만들지 않는다', () => {
    // 가상 스크롤로 카드가 언마운트·재마운트되는 상황의 단위 테스트 대역 - 로컬 hasError는
    // 언마운트되며 사라지지만, 실패 횟수는 세션 캐시(failedImageCache)에 남아있어야 한다.
    const first = render(<LinkThumbnail src="https://example.com/twice.png" alt="제목" />);
    fireEvent.error(first.getByRole('img', { name: '제목' }));
    first.unmount();

    const second = render(<LinkThumbnail src="https://example.com/twice.png" alt="제목" />);
    fireEvent.error(second.getByRole('img', { name: '제목' }));
    second.unmount();

    const { container } = render(<LinkThumbnail src="https://example.com/twice.png" alt="제목" />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('한 번만 실패한 src는 재마운트 시 다시 시도한다', () => {
    const first = render(<LinkThumbnail src="https://example.com/once.png" alt="제목" />);
    fireEvent.error(first.getByRole('img', { name: '제목' }));
    first.unmount();

    const { getByRole } = render(<LinkThumbnail src="https://example.com/once.png" alt="제목" />);

    expect(getByRole('img', { name: '제목' })).toBeInTheDocument();
  });

  it('실패하지 않은 다른 src는 이전 실패의 영향 없이 img를 렌더한다', () => {
    const first = render(<LinkThumbnail src="https://example.com/twice.png" alt="제목" />);
    fireEvent.error(first.getByRole('img', { name: '제목' }));
    first.unmount();

    const second = render(<LinkThumbnail src="https://example.com/twice.png" alt="제목" />);
    fireEvent.error(second.getByRole('img', { name: '제목' }));
    second.unmount();

    const { getByRole } = render(<LinkThumbnail src="https://example.com/other.png" alt="제목" />);

    expect(getByRole('img', { name: '제목' })).toBeInTheDocument();
  });

  it('http src의 실패는 https로 치환된 키로 기록된다', () => {
    const first = render(<LinkThumbnail src="http://example.com/insecure.png" alt="제목" />);
    fireEvent.error(first.getByRole('img', { name: '제목' }));
    first.unmount();

    const second = render(<LinkThumbnail src="http://example.com/insecure.png" alt="제목" />);
    fireEvent.error(second.getByRole('img', { name: '제목' }));
    second.unmount();

    const { container } = render(
      <LinkThumbnail src="https://example.com/insecure.png" alt="제목" />
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  // 공용 UI 부품의 API 규칙: ref·className·나머지 속성은 맨 바깥 요소 하나로 간다
  // (docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4). 이미지에 거는 연출은 imageClassName으로 따로 받는다.
  it('className은 맨 바깥 요소에만 붙는다', () => {
    const { container } = render(
      <LinkThumbnail src="https://example.com/thumb.png" alt="제목" className="outer-class" />
    );

    expect([...container.querySelectorAll('.outer-class')]).toEqual([container.firstElementChild]);
  });

  it('imageClassName은 이미지 요소에만 붙는다', () => {
    const { container, getByRole } = render(
      <LinkThumbnail src="https://example.com/thumb.png" alt="제목" imageClassName="image-class" />
    );

    expect([...container.querySelectorAll('.image-class')]).toEqual([
      getByRole('img', { name: '제목' }),
    ]);
  });

  it('ref와 나머지 속성은 맨 바깥 요소에 닿는다', () => {
    const ref = createRef<HTMLDivElement>();

    const { container } = render(
      <LinkThumbnail
        ref={ref}
        src="https://example.com/thumb.png"
        alt="제목"
        data-testid="thumbnail"
      />
    );

    expect(container.firstElementChild).not.toBeNull();
    expect(ref.current).toBe(container.firstElementChild);
    expect(container.firstElementChild).toHaveAttribute('data-testid', 'thumbnail');
  });

  it('이미지 로드에 실패해 안내 아이콘으로 바뀌어도 className은 맨 바깥 요소에 남는다', () => {
    const { container, getByRole } = render(
      <LinkThumbnail
        src="https://example.com/broken-with-class.png"
        alt="제목"
        className="outer-class"
        imageClassName="image-class"
      />
    );

    fireEvent.error(getByRole('img', { name: '제목' }));

    expect([...container.querySelectorAll('.outer-class')]).toEqual([container.firstElementChild]);
    // 이미지 요소가 없으면 imageClassName은 어디에도 쓰이지 않는다(안내 아이콘에 붙이지 않는다)
    expect(container.querySelector('.image-class')).not.toBeInTheDocument();
  });
});
