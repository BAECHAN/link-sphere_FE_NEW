import type { Meta, StoryObj } from '@storybook/react';
import { ErrorState } from '@/shared/ui/elements/ErrorState';

const meta = {
  title: 'Shared/UI/Elements/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof ErrorState>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: '목록을 불러오지 못했습니다.',
  },
};
