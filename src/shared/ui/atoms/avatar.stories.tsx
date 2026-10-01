import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui/atoms/avatar';

const meta = {
  title: 'Shared/UI/Atoms/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof Avatar>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

// 깨진 이미지는 없는 경로("/broken-image.jpg" 등) 대신 비어 있는 data URI로 만든다. 없는 경로는
// 개발 서버가 SPA 폴백으로 index.html을 돌려주고, 그 과정에서 앱 진입점(src/main.tsx)까지 변환되며
// 스토리와 무관한 의존성이 뒤늦게 최적화돼 Storybook 테스트가 리로드로 간헐 실패했다
// (docs/DESIGN-SYSTEM.md §10 "Storybook a11y CI 간헐 실패").
export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="data:image/png;base64," alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};
