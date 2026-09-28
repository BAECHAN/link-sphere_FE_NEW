import type { Meta, StoryObj } from '@storybook/react';
import { Divider } from '@/shared/ui/atoms/divider';

const meta = {
  title: 'Shared/UI/Atoms/Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof Divider>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <Divider {...args} />
    </div>
  ),
};

export const WithMargin: Story = {
  render: (args) => (
    <div className="w-80 bg-muted/30">
      <Divider {...args} className="my-4" />
    </div>
  ),
};
