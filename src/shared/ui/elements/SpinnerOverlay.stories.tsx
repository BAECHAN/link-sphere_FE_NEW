import type { Meta, StoryObj } from '@storybook/react';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

const meta = {
  title: 'Shared/UI/Elements/SpinnerOverlay',
  component: SpinnerOverlay,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '지연 게이트가 지나면 fade-in(200ms)으로 나타난다. delay=0으로 두면 즉시 페이드인만 확인할 수 있다.',
      },
    },
  },
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
