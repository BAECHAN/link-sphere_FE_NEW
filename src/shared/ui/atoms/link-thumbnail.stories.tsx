import type { Meta, StoryObj } from '@storybook/react';
import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';

const meta = {
  title: 'Shared/UI/Atoms/LinkThumbnail',
  component: LinkThumbnail,
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    priority: { control: 'boolean' },
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
// 이 스토리를 두 번 이상 다시 마운트하면 세션 캐시(failedImageCache)에 실패가 누적돼
// 세 번째 마운트부터는 네트워크 시도 없이 바로 폴백이 뜬다 - 정상 동작이다.
export const LoadFailed: Story = {
  args: {
    src: 'https://invalid.example/thumb.png',
    alt: '로드 실패한 이미지',
  },
};

// LCP 후보(목록 첫 행 등)에 쓰는 우선순위 로딩 — loading="eager" + fetchPriority="high"
export const Priority: Story = {
  args: {
    src: 'https://picsum.photos/seed/link-sphere-priority/800/450',
    alt: '우선순위 로딩 이미지',
    priority: true,
  },
};
