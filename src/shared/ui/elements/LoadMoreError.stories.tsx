import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { LoadMoreError } from '@/shared/ui/elements/LoadMoreError';

const meta = {
  title: 'Shared/UI/Elements/LoadMoreError',
  component: LoadMoreError,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
  args: {
    onRetry: fn(),
  },
} satisfies Meta<typeof LoadMoreError>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 받은 카드 아래, 스피너가 있던 자리 */
export const BelowList: Story = {
  render: (args) => (
    <div className="max-w-sm">
      <div className="rounded-xl border bg-card p-4 text-sm">마지막으로 받은 카드</div>
      <LoadMoreError {...args} className="mt-6" />
    </div>
  ),
};
