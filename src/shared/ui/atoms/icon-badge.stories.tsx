import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mail } from 'lucide-react';
import { IconBadge } from '@/shared/ui/atoms/icon-badge';

const meta = {
  title: 'Shared/UI/Atoms/IconBadge',
  component: IconBadge,
  tags: ['autodocs'],
  argTypes: {
    tone: {
      control: 'select',
      options: ['info', 'success', 'warning', 'destructive'],
    },
  },
  args: {
    icon: Mail,
    tone: 'info',
  },
} satisfies Meta<typeof IconBadge>;

// eslint-disable-next-line import/no-default-export
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllTones: Story = {
  render: () => (
    <div className="flex gap-4">
      <IconBadge icon={Mail} tone="info" />
      <IconBadge icon={Mail} tone="success" />
      <IconBadge icon={Mail} tone="warning" />
      <IconBadge icon={Mail} tone="destructive" />
    </div>
  ),
};
