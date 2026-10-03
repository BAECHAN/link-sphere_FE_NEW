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
