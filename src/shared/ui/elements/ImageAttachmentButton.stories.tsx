import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ImageAttachmentButton } from '@/shared/ui/elements/ImageAttachmentButton';
import { ImageAttachmentPreviews } from '@/shared/ui/elements/ImageAttachmentPreviews';

const meta = {
  title: 'Shared/UI/Elements/ImageAttachmentButton',
  component: ImageAttachmentButton,
  tags: ['autodocs'],
  args: {
    count: 0,
    maxCount: 4,
    onAttach: () => {},
  },
} satisfies Meta<typeof ImageAttachmentButton>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

/** 실제로 첨부해 보는 예시 - 댓글 폼처럼 썸네일을 위 줄에, 버튼을 아래 줄에 둔다 */
function InteractiveImageAttachment() {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const maxCount = 4;

  return (
    <div className="space-y-2">
      <ImageAttachmentPreviews
        previewUrls={previewUrls}
        onRemove={(index) => {
          setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
        }}
      />
      <ImageAttachmentButton
        count={previewUrls.length}
        maxCount={maxCount}
        onAttach={(files) => {
          const urls = Array.from(files).map((file) => URL.createObjectURL(file));
          setPreviewUrls((prev) => [...prev, ...urls].slice(0, maxCount));
        }}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <InteractiveImageAttachment />,
};

export const Full: Story = {
  args: { count: 4 },
};
