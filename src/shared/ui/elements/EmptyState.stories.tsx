import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from '@/shared/ui/elements/EmptyState';

const meta = {
  title: 'Shared/UI/Elements/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof EmptyState>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: '등록된 링크가 없거나 검색 결과가 없어요.',
  },
};

export const WithBorder: Story = {
  args: {
    children: '등록된 링크가 없거나 검색 결과가 없어요.',
    className: 'border rounded-lg bg-muted/10',
  },
};
