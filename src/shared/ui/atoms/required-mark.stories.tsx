import type { Meta, StoryObj } from '@storybook/react-vite';
import { RequiredMark } from '@/shared/ui/atoms/required-mark';
import { Label } from '@/shared/ui/atoms/label';

const meta = {
  title: 'Shared/UI/Atoms/RequiredMark',
  component: RequiredMark,
  tags: ['autodocs'],
} satisfies Meta<typeof RequiredMark>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: () => (
    <Label htmlFor="url">
      <span>
        URL
        <RequiredMark />
      </span>
    </Label>
  ),
};
