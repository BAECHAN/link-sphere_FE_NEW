import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TEXTS } from '@/shared/config/texts';
import { LinkPreviewCard } from '@/entities/post/ui/LinkPreviewCard';

const PREVIEW = {
  url: 'https://react.dev/learn',
  title: 'Quick Start – React',
  description: 'The library for web and native user interfaces',
  ogImage: null,
};

describe('LinkPreviewCard', () => {
  it('idle·urlError면 아무것도 그리지 않는다(URL 칸 에러가 대신 보인다)', () => {
    const { container: idle } = render(<LinkPreviewCard state={{ status: 'idle' }} />);
    const { container: urlError } = render(
      <LinkPreviewCard state={{ status: 'urlError', message: 'x' }} />
    );

    expect(idle).toBeEmptyDOMElement();
    expect(urlError).toBeEmptyDOMElement();
  });

  it('reserveSpace면 idle·urlError에도 같은 자리에 안내를 깔아 둔다(데스크톱 제출 버튼 밀림 방지)', () => {
    const { unmount } = render(<LinkPreviewCard state={{ status: 'idle' }} reserveSpace />);

    expect(screen.getByText(TEXTS.post.form.preview.placeholder)).toBeInTheDocument();
    unmount();

    render(<LinkPreviewCard state={{ status: 'urlError', message: 'x' }} reserveSpace />);

    expect(screen.getByText(TEXTS.post.form.preview.placeholder)).toBeInTheDocument();
    // 안내 자리는 미리보기 카드가 아니다 - URL 칸 에러 e2e가 카드 없음을 확인한다
    expect(screen.queryByLabelText(TEXTS.post.form.preview.ariaLabel)).not.toBeInTheDocument();
  });

  it('가져오는 중이면 같은 자리에 스켈레톤과 안내를 보여준다', () => {
    render(<LinkPreviewCard state={{ status: 'loading' }} />);

    expect(screen.getByText(TEXTS.post.form.preview.loading)).toBeInTheDocument();
    expect(screen.getByLabelText(TEXTS.post.form.preview.ariaLabel)).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });

  it('사용자가 제목을 입력했으면 그 제목으로 보여준다', () => {
    render(
      <LinkPreviewCard state={{ status: 'ready', preview: PREVIEW }} titleOverride="내 제목" />
    );

    expect(screen.getByText('내 제목')).toBeInTheDocument();
    expect(screen.getByText(PREVIEW.description)).toBeInTheDocument();
  });

  it('설명·썸네일이 모두 없으면 정보를 못 가져왔다고 안내한다', () => {
    render(
      <LinkPreviewCard state={{ status: 'ready', preview: { ...PREVIEW, description: null } }} />
    );

    expect(screen.getByText(TEXTS.post.card.metadataUnavailable)).toBeInTheDocument();
  });

  it('실패하면 등록은 할 수 있다고 안내한다', () => {
    render(<LinkPreviewCard state={{ status: 'failed' }} />);

    expect(screen.getByText(TEXTS.post.form.preview.failed)).toBeInTheDocument();
  });
});
