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
    content: 'https://picsum.photos/seed/link-sphere/400/300',
  },
};
