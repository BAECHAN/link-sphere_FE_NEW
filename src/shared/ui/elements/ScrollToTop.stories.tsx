import type { Meta, StoryObj } from '@storybook/react';
import { ScrollToTop } from '@/shared/ui/elements/ScrollToTop';

const meta: Meta<typeof ScrollToTop> = {
  title: 'Shared/UI/Elements/ScrollToTop',
  component: ScrollToTop,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="min-h-[200vh] w-full p-4">
        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            아래로 스크롤하여 ScrollToTop 버튼을 확인하세요. (300px 이상 스크롤 시 노출)
          </p>
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScrollToTop>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
