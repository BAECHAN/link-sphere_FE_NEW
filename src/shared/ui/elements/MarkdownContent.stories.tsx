import type { Meta, StoryObj } from '@storybook/react';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';

const meta = {
  title: 'Shared/UI/Elements/MarkdownContent',
  component: MarkdownContent,
  tags: ['autodocs'],
  argTypes: {
    content: { control: 'text' },
    isMobile: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkdownContent>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: '일반 텍스트와 https://example.com 링크가 함께 있는 댓글입니다.',
  },
};

export const Headings: Story = {
  args: {
    content: '# 제목1\n## 제목2\n### 제목3\n#### 제목4\n본문 텍스트',
  },
};

export const CodeBlock: Story = {
  args: {
    content: '설명 텍스트\n```ts\nconst x = 1;\nconsole.log(x);\n```',
  },
};

export const Image: Story = {
  args: {
    content: 'https://picsum.photos/seed/link-sphere/400/300.jpg',
  },
};

/**
 * Supabase storage 공개 URL 형태의 첨부 이미지 - 로드 전에도 정사각 자리(bg-muted)가
 * 미리 예약되는지 보여준다. Storybook은 이 호스트에 닿지 않으므로 화면에 보이는 게
 * 곧 "로드 전/실패 상태" = 이번에 예약해두는 자리 그 자체다.
 */
export const StorageAttachment: Story = {
  args: {
    content: 'https://project.supabase.co/storage/v1/object/public/comments/sample.png',
  },
};
