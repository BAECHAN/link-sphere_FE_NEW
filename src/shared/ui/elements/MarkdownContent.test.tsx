import { describe, it, expect } from 'vitest';
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
});
