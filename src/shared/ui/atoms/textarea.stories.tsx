import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { Label } from '@/shared/ui/atoms/label';

// Wrapper for Label + Textarea
const meta = {
  title: 'Shared/UI/Atoms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Textarea>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Type your message here.',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'You cannot type here.',
  },
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-full gap-1.5">
      <Label htmlFor="message">Your message</Label>
      <Textarea placeholder="Type your message here." id="message" {...args} />
      <p className="text-sm text-muted-foreground">
        Your message will be copied to the support team.
      </p>
    </div>
  ),
};
