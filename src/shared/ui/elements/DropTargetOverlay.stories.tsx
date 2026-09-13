import type { Meta, StoryObj } from '@storybook/react';
import { DropTargetOverlay } from '@/shared/ui/elements/DropTargetOverlay';

const noop = () => {};

const meta = {
  title: 'Shared/UI/Elements/DropTargetOverlay',
  component: DropTargetOverlay,
  tags: ['autodocs'],
  args: {
    onDrop: noop,
    onDragOver: noop,
    onDragEnter: noop,
    onDragLeave: noop,
  },
  decorators: [
    (Story) => (
      <div className="relative h-40 w-full rounded-md border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DropTargetOverlay>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
