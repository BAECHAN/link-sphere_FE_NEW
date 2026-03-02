import type { Meta, StoryObj } from '@storybook/react';
import { Spinner } from '@/shared/ui/atoms/spinner';

const meta = {
  title: 'Shared/UI/Atoms/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof Spinner>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: {
    className: 'size-10',
  },
};

export const Small: Story = {
  args: {
    className: 'size-3',
  },
};

export const CustomColor: Story = {
  args: {
    className: 'size-6 text-blue-500',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-6" />
      <Spinner className="size-10" />
    </div>
  ),
};
