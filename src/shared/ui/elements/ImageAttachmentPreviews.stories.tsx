import type { Meta, StoryObj } from '@storybook/react-vite';
import { ImageAttachmentPreviews } from '@/shared/ui/elements/ImageAttachmentPreviews';

const meta = {
  title: 'Shared/UI/Elements/ImageAttachmentPreviews',
  component: ImageAttachmentPreviews,
  tags: ['autodocs'],
  args: {
    previewUrls: [
      'https://picsum.photos/seed/attach-1/200/200',
      'https://picsum.photos/seed/attach-2/200/200',
    ],
    onRemove: () => {},
  },
} satisfies Meta<typeof ImageAttachmentPreviews>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const WithPreviews: Story = {};
