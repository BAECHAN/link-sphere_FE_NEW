import { describe, it, expect } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';

const STORAGE_URL = 'https://project.supabase.co/storage/v1/object/public/comments/a.png';

describe('MarkdownContent', () => {
  it('Supabase storage 이미지는 변환 URL로 렌더되고 정사각 자리가 예약된 래퍼 안에 있다', () => {
    const { getByRole } = renderWithProviders(<MarkdownContent content={STORAGE_URL} />);

    const img = getByRole('img', { name: 'attachment' });
    expect(img.getAttribute('src')).toContain('/storage/v1/render/image/public/');
    expect(img.parentElement?.className).toContain('aspect-square');
  });

  it('Supabase 이미지 변환이 실패하면 원본 주소로 다시 받는다', () => {
    const { getByRole } = renderWithProviders(<MarkdownContent content={STORAGE_URL} />);

    fireEvent.error(getByRole('img', { name: 'attachment' }));

    expect(getByRole('img', { name: 'attachment' })).toHaveAttribute('src', STORAGE_URL);
  });

  it('변환이 실패한 뒤 본문의 이미지 주소가 바뀌면 새 주소는 다시 변환 주소부터 받는다', () => {
    const { getByRole, rerender } = renderWithProviders(<MarkdownContent content={STORAGE_URL} />);
    fireEvent.error(getByRole('img', { name: 'attachment' }));

    rerender(<MarkdownContent content={STORAGE_URL.replace('a.png', 'b.png')} />);

    expect(getByRole('img', { name: 'attachment' }).getAttribute('src')).toContain(
      '/storage/v1/render/image/public/comments/b.png'
    );
  });

  it('blob: 미리보기는 원본 src 그대로, 자리 예약 래퍼 없이 렌더된다', () => {
    const blobUrl = 'blob:https://link-sphere.app/temp-preview';
    const { getByRole } = renderWithProviders(<MarkdownContent content={blobUrl} />);

    const img = getByRole('img', { name: 'attachment' });
    expect(img).toHaveAttribute('src', blobUrl);
    expect(img.parentElement?.className).not.toContain('aspect-square');
    expect(img.className).toContain('max-h-60');
  });

  it('외부 이미지 링크는 원본 src 그대로, 자리 예약 래퍼 없이 렌더된다', () => {
    const externalUrl = 'https://example.com/photo.png';
    const { getByRole } = renderWithProviders(<MarkdownContent content={externalUrl} />);

    const img = getByRole('img', { name: 'attachment' });
    expect(img).toHaveAttribute('src', externalUrl);
    expect(img.parentElement?.className).not.toContain('aspect-square');
    expect(img.className).toContain('max-h-60');
  });

  it('업로드한 SVG는 링크가 아니라 이미지로 렌더되고, 변환을 거치지 않은 원본 src를 쓴다', () => {
    const svgUrl = 'https://project.supabase.co/storage/v1/object/public/comments/diagram.svg';
    const { getByRole } = renderWithProviders(<MarkdownContent content={svgUrl} />);

    const img = getByRole('img', { name: 'attachment' });
    expect(img).toHaveAttribute('src', svgUrl);
  });
});
