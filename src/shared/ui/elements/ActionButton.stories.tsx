import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { ActionButton } from '@/shared/ui/elements/ActionButton';
import { Heart, Bookmark, Share2, ThumbsUp } from 'lucide-react';

const meta = {
  title: 'Shared/UI/Elements/ActionButton',
  component: ActionButton,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    className: { control: 'text' },
    iconClassName: { control: 'text' },
  },
  args: {
    label: 'Action',
    onClick: fn(),
  },
} satisfies Meta<typeof ActionButton>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    label: 'Like',
    icon: Heart,
  },
};

export const WithIconAndStyling: Story = {
  args: {
    label: 'Bookmark',
    icon: Bookmark,
    className: 'text-blue-600 hover:text-blue-800',
    iconClassName: 'text-blue-500',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ActionButton label="Like" icon={Heart} onClick={() => {}} />
      <ActionButton label="Bookmark" icon={Bookmark} onClick={() => {}} />
      <ActionButton label="Share" icon={Share2} onClick={() => {}} />
      <ActionButton label="Upvote" icon={ThumbsUp} onClick={() => {}} />
      <ActionButton label="No Icon" onClick={() => {}} />
    </div>
  ),
};
