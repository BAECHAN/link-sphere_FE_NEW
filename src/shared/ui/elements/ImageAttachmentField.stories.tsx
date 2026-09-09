import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ImageAttachmentField } from '@/shared/ui/elements/ImageAttachmentField';

const meta = {
  title: 'Shared/UI/Elements/ImageAttachmentField',
  component: ImageAttachmentField,
  tags: ['autodocs'],
  args: {
    previewUrls: [],
    count: 0,
    maxCount: 4,
    onAttach: () => {},
    onRemove: () => {},
  },
} satisfies Meta<typeof ImageAttachmentField>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveImageAttachmentField() {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const maxCount = 4;

  return (
    <ImageAttachmentField
      previewUrls={previewUrls}
      count={previewUrls.length}
      maxCount={maxCount}
      onAttach={(files) => {
        const urls = Array.from(files).map((file) => URL.createObjectURL(file));
        setPreviewUrls((prev) => [...prev, ...urls].slice(0, maxCount));
      }}
      onRemove={(index) => {
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
      }}
    />
  );
}

export const Default: Story = {
  render: () => <InteractiveImageAttachmentField />,
};

export const WithPreviews: Story = {
  render: () => (
    <ImageAttachmentField
      previewUrls={[
        'https://picsum.photos/seed/attach-1/200/200',
        'https://picsum.photos/seed/attach-2/200/200',
      ]}
      count={2}
      maxCount={4}
      onAttach={() => {}}
      onRemove={() => {}}
    />
  ),
};

export const Full: Story = {
  render: () => (
    <ImageAttachmentField
      previewUrls={['https://picsum.photos/seed/attach-full/200/200']}
      count={4}
      maxCount={4}
      onAttach={() => {}}
      onRemove={() => {}}
    />
  ),
};
