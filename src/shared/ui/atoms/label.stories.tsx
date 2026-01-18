import type { Meta, StoryObj } from '@storybook/react';
import { Label } from '@/shared/ui/atoms/label';
import { Checkbox } from '@/shared/ui/atoms/checkbox';

const meta = {
  title: 'Shared/UI/Atoms/Label',
  component: Label,
  tags: ['autodocs'],
  argTypes: {
    htmlFor: { control: 'text' },
  },
} satisfies Meta<typeof Label>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Accept terms and conditions',
  },
};

export const WithControl: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  ),
};
