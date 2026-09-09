import type { Meta, StoryObj } from '@storybook/react';
import { AppErrorFallback } from '@/shared/ui/elements/AppErrorFallback';

const meta = {
  title: 'Shared/UI/Elements/AppErrorFallback',
  component: AppErrorFallback,
  tags: ['autodocs'],
} satisfies Meta<typeof AppErrorFallback>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

// 청크 로드 실패·5xx 에러는 window.location 리다이렉트를 트리거해 Storybook에서
// 재현할 수 없다 - 일반 에러의 안내 화면 렌더링 경로만 보여준다.
export const Default: Story = {
  args: {
    error: new Error('예상치 못한 오류'),
  },
};
