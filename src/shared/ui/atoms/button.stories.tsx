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
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
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
