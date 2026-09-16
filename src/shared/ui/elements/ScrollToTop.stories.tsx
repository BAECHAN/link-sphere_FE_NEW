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

export const Default: Story = {
  // 데코레이터 안내 문구가 --muted-foreground(4.34:1)를 쓴다 - kbd.stories.tsx와
  // 같은 이유로 미룬다(2026-09-16 a11y 게이트 실측, docs/DESIGN-SYSTEM.md §11 참고).
  parameters: { a11y: { test: 'todo' } },
};
