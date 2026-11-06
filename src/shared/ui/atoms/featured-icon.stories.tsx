import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mail } from 'lucide-react';
import { FeaturedIcon } from '@/shared/ui/atoms/featured-icon';

const meta = {
  title: 'Shared/UI/Atoms/FeaturedIcon',
  component: FeaturedIcon,
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
} satisfies Meta<typeof FeaturedIcon>;

// eslint-disable-next-line import/no-default-export
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllTones: Story = {
  render: () => (
    <div className="flex gap-4">
      <FeaturedIcon icon={Mail} tone="info" />
      <FeaturedIcon icon={Mail} tone="success" />
      <FeaturedIcon icon={Mail} tone="warning" />
      <FeaturedIcon icon={Mail} tone="destructive" />
    </div>
  ),
};
