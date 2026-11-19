import type { Meta, StoryObj } from '@storybook/react-vite';
import { Mail } from 'lucide-react';
import { FeaturedIcon } from '@/shared/ui/atoms/featured-icon';

const meta = {
  title: 'Shared/UI/Atoms/FeaturedIcon',
  component: FeaturedIcon,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['info', 'success', 'warning', 'destructive'],
    },
  },
  args: {
    icon: Mail,
    variant: 'info',
  },
} satisfies Meta<typeof FeaturedIcon>;

// eslint-disable-next-line import/no-default-export
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <FeaturedIcon icon={Mail} variant="info" />
      <FeaturedIcon icon={Mail} variant="success" />
      <FeaturedIcon icon={Mail} variant="warning" />
      <FeaturedIcon icon={Mail} variant="destructive" />
    </div>
  ),
};
