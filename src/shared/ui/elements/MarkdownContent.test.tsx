import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { NavigationService } from '@/shared/lib/router/navigation';
import { useImageViewerStore } from '@/shared/ui/elements/dialog/image-viewer/imageViewer.store';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';

const STORAGE_URL = 'https://project.supabase.co/storage/v1/object/public/comments/a.png';

describe('MarkdownContent', () => {
  it('Supabase storage 이미지는 변환 URL로 렌더되고 정사각 자리가 예약된 래퍼 안에 있다', () => {
    const { getByRole } = renderWithProviders(<MarkdownContent content={STORAGE_URL} />);

    const img = getByRole('img', { name: TEXTS.ariaLabels.attachmentImage });
    expect(img.getAttribute('src')).toContain('/storage/v1/render/image/public/');
    expect(img.parentElement?.className).toContain('aspect-square');
  });

  it('Supabase 이미지 변환이 실패하면 원본 주소로 다시 받는다', () => {
    const { getByRole } = renderWithProviders(<MarkdownContent content={STORAGE_URL} />);

    fireEvent.error(getByRole('img', { name: TEXTS.ariaLabels.attachmentImage }));

    expect(getByRole('img', { name: TEXTS.ariaLabels.attachmentImage })).toHaveAttribute(
      'src',
      STORAGE_URL
    );
  });

  it('변환이 실패한 뒤 본문의 이미지 주소가 바뀌면 새 주소는 다시 변환 주소부터 받는다', () => {
    const { getByRole, rerender } = renderWithProviders(<MarkdownContent content={STORAGE_URL} />);
    fireEvent.error(getByRole('img', { name: TEXTS.ariaLabels.attachmentImage }));

    rerender(<MarkdownContent content={STORAGE_URL.replace('a.png', 'b.png')} />);

    expect(
      getByRole('img', { name: TEXTS.ariaLabels.attachmentImage }).getAttribute('src')
    ).toContain('/storage/v1/render/image/public/comments/b.png');
  });

  it('blob: 미리보기는 원본 src 그대로, 자리 예약 래퍼 없이 렌더된다', () => {
    const blobUrl = 'blob:https://link-sphere.app/temp-preview';
    const { getByRole } = renderWithProviders(<MarkdownContent content={blobUrl} />);

    const img = getByRole('img', { name: TEXTS.ariaLabels.attachmentImage });
    expect(img).toHaveAttribute('src', blobUrl);
    expect(img.parentElement?.className).not.toContain('aspect-square');
    expect(img.className).toContain('max-h-60');
  });

  it('외부 이미지 링크는 원본 src 그대로, 자리 예약 래퍼 없이 렌더된다', () => {
    const externalUrl = 'https://example.com/photo.png';
    const { getByRole } = renderWithProviders(<MarkdownContent content={externalUrl} />);

    const img = getByRole('img', { name: TEXTS.ariaLabels.attachmentImage });
    expect(img).toHaveAttribute('src', externalUrl);
    expect(img.parentElement?.className).not.toContain('aspect-square');
    expect(img.className).toContain('max-h-60');
  });

  it('업로드한 SVG는 링크가 아니라 이미지로 렌더되고, 변환을 거치지 않은 원본 src를 쓴다', () => {
    const svgUrl = 'https://project.supabase.co/storage/v1/object/public/comments/diagram.svg';
    const { getByRole } = renderWithProviders(<MarkdownContent content={svgUrl} />);

    const img = getByRole('img', { name: TEXTS.ariaLabels.attachmentImage });
    expect(img).toHaveAttribute('src', svgUrl);
  });

  it('확대 창에 넘기는 이미지는 이전·다음으로 넘겨도 구분되게 순번이 붙은 이름을 갖는다', () => {
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const secondUrl = STORAGE_URL.replace('a.png', 'b.png');
    const { getByRole } = renderWithProviders(
      <MarkdownContent content={`${STORAGE_URL} ${secondUrl}`} />
    );

    fireEvent.click(getByRole('button', { name: TEXTS.ariaLabels.imageZoomAt(2) }));

    expect(useImageViewerStore.getState().images).toEqual([
      { src: STORAGE_URL, alt: TEXTS.ariaLabels.attachmentImageAt(1) },
      { src: secondUrl, alt: TEXTS.ariaLabels.attachmentImageAt(2) },
    ]);
    expect(useImageViewerStore.getState().currentIndex).toBe(1);
    navigateSpy.mockRestore();
  });

  it('이미지가 여러 장이면 확대 버튼 이름이 순번으로 구분되고, 누르면 그 이미지부터 연다', () => {
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const secondUrl = STORAGE_URL.replace('a.png', 'b.png');
    const { getByRole } = renderWithProviders(
      <MarkdownContent content={`${STORAGE_URL} ${secondUrl}`} />
    );

    fireEvent.click(getByRole('button', { name: TEXTS.ariaLabels.imageZoomAt(1) }));

    expect(useImageViewerStore.getState().currentIndex).toBe(0);

    fireEvent.click(getByRole('button', { name: TEXTS.ariaLabels.imageZoomAt(2) }));

    expect(useImageViewerStore.getState().currentIndex).toBe(1);
    navigateSpy.mockRestore();
  });

  it('닫힌 코드 블록 안 이미지 주소는 글자로만 보이고 확대 창 목록과 번호에 들어가지 않는다', () => {
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const codeBlockUrl = STORAGE_URL.replace('a.png', 'in-code.png');
    const { getByRole, getByText } = renderWithProviders(
      <MarkdownContent content={`\`\`\`\n${codeBlockUrl}\n\`\`\`\n${STORAGE_URL}`} />
    );

    expect(getByText(codeBlockUrl).tagName).toBe('CODE');

    fireEvent.click(getByRole('button', { name: TEXTS.ariaLabels.imageZoomAt(1) }));

    expect(useImageViewerStore.getState().images).toEqual([
      { src: STORAGE_URL, alt: TEXTS.ariaLabels.attachmentImageAt(1) },
    ]);
    expect(useImageViewerStore.getState().currentIndex).toBe(0);
    navigateSpy.mockRestore();
  });

  it('닫히지 않은 코드 블록의 이미지 주소는 버튼으로 그려지므로 그대로 센다', () => {
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const { getByRole } = renderWithProviders(
      <MarkdownContent content={`\`\`\`\n${STORAGE_URL}`} />
    );

    fireEvent.click(getByRole('button', { name: TEXTS.ariaLabels.imageZoomAt(1) }));

    expect(useImageViewerStore.getState().images).toEqual([
      { src: STORAGE_URL, alt: TEXTS.ariaLabels.attachmentImageAt(1) },
    ]);
    navigateSpy.mockRestore();
  });
});
