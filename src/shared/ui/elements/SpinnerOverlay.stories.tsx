import type { Meta, StoryObj } from '@storybook/react';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

const meta = {
  title: 'Shared/UI/Elements/SpinnerOverlay',
  component: SpinnerOverlay,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
    spinnerClassName: { control: 'text' },
    delay: { control: 'number' },
  },
  args: {
    delay: 0,
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 w-full border border-dashed border-muted-foreground rounded-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpinnerOverlay>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LargeSpinner: Story = {
  args: {
    spinnerClassName: 'size-16',
  },
};

export const CustomBackground: Story = {
  args: {
    className: 'bg-black/50 rounded-lg',
  },
};
