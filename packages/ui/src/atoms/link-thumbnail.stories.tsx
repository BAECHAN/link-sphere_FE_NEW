import type { Meta, StoryObj } from '@storybook/react-vite';
import { LinkThumbnail } from '@baechan/ui/atoms/link-thumbnail';

const meta = {
  title: 'Shared/UI/Atoms/LinkThumbnail',
  component: LinkThumbnail,
  tags: ['autodocs'],
  argTypes: {
    src: { control: 'text' },
    alt: { control: 'text' },
    className: { control: 'text' },
    imageClassName: { control: 'text' },
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

// 이미지에만 거는 연출은 imageClassName으로 넘긴다(className은 맨 바깥 요소로 간다).
// 감싼 요소(group)에 마우스를 올리면 이미지만 커지고, 넘친 부분은 맨 바깥 요소가 잘라 자리 크기는 그대로다
export const ImageClassName: Story = {
  args: {
    src: 'https://picsum.photos/seed/link-sphere-hover/800/450',
    alt: '마우스를 올리면 커지는 이미지',
    imageClassName: 'group-hover:scale-105 transition-transform duration-300',
  },
  decorators: [
    (Story) => (
      <div className="group">
        <Story />
      </div>
    ),
  ],
};
