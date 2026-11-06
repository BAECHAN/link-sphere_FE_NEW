import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { ImageAttachmentField } from '@/shared/ui/elements/ImageAttachmentField';

describe('ImageAttachmentField', () => {
  it('미리보기 이미지는 순번이 붙은 한국어 이름으로 읽힌다', () => {
    const { getByRole } = renderWithProviders(
      <ImageAttachmentField
        previewUrls={['blob:https://link-sphere.app/a', 'blob:https://link-sphere.app/b']}
        count={2}
        maxCount={4}
        onAttach={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    expect(getByRole('img', { name: TEXTS.ariaLabels.attachmentImageAt(1) })).toHaveAttribute(
      'src',
      'blob:https://link-sphere.app/a'
    );
    expect(getByRole('img', { name: TEXTS.ariaLabels.attachmentImageAt(2) })).toHaveAttribute(
      'src',
      'blob:https://link-sphere.app/b'
    );
  });
});
