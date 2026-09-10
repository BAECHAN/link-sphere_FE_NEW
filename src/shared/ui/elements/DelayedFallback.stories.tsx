import type { Meta, StoryObj } from '@storybook/react';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import { Skeleton } from '@/shared/ui/atoms/skeleton';

const meta = {
  title: 'Shared/UI/Elements/DelayedFallback',
  component: DelayedFallback,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
    delay: { control: 'number' },
  },
  args: {
    delay: 0,
  },
} satisfies Meta<typeof DelayedFallback>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="p-4 text-sm text-muted-foreground">즉시 표시됨 (delay=0)</div>,
  },
};

export const WithDelay: Story = {
  args: {
    delay: 500,
    children: <div className="p-4 text-sm text-muted-foreground">500ms 뒤에 표시됨</div>,
  },
};

export const SkeletonChild: Story = {
  args: {
    delay: 500,
    children: (
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    ),
  },
};
