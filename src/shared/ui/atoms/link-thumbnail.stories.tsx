import type { Meta, StoryObj } from '@storybook/react';
import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';

const meta = {
  title: 'Shared/UI/Atoms/LinkThumbnail',
  component: LinkThumbnail,
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LinkThumbnail>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: 'https://picsum.photos/seed/link-sphere/800/450',
    alt: '링크 미리보기 이미지',
  },
};

// src가 없으면 og:image가 없는 게시글이다 - 영역을 통째로 감춘다
export const NoSource: Story = {
  args: {
    src: null,
    alt: '이미지 없음',
  },
};

// 원본 사이트가 이미지를 내리거나 차단한 경우 - 자리는 유지하고 안내 아이콘으로 대체한다
// (레이아웃 시프트를 막기 위해 영역 자체를 없애지 않는다, link-thumbnail.tsx 상단 주석 참고)
export const LoadFailed: Story = {
  args: {
    src: 'https://invalid.example/thumb.png',
    alt: '로드 실패한 이미지',
  },
};
