import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/shared/ui/atoms/button';
import { Mail, Loader2 } from 'lucide-react';

const meta = {
  title: 'Shared/UI/Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'none'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
    asChild: { control: false },
  },
  args: {
    variant: 'default',
    size: 'default',
    children: 'Button',
  },
} satisfies Meta<typeof Button>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

// 호버해도 색이 변하지 않는 variant — 배경·글자색을 호출부가 정하는 FilterChip 같은
// 컴포넌트용이라 여기선 배경 없이 렌더된다(base의 레이아웃·포커스 링은 그대로 적용).
export const None: Story = {
  args: {
    variant: 'none',
    children: 'None',
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Icon: Story = {
  args: {
    size: 'icon',
    variant: 'outline',
    children: <Mail className="size-4" />,
    // 아이콘만 있는 버튼은 스크린리더가 읽을 텍스트가 없다 - aria-label 필수
    // (a11y 게이트가 실측으로 발견, 2026-09-16)
    'aria-label': 'Email',
  },
};

export const WithIcon: Story = {
  render: (args) => (
    <Button {...args}>
      <Mail className="size-4" /> Login with Email
    </Button>
  ),
};

export const Loading: Story = {
  render: (args) => (
    <Button disabled {...args}>
      <Loader2 className="size-4 animate-spin" />
      Please wait
    </Button>
  ),
};
