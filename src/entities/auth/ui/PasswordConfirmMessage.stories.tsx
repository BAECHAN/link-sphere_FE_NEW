import type { Meta, StoryObj } from '@storybook/react';
import { PasswordConfirmMessage } from '@/entities/auth/ui/PasswordConfirmMessage';

const meta = {
  title: 'Entities/Auth/PasswordConfirmMessage',
  component: PasswordConfirmMessage,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex w-80 flex-col gap-2">
        <Story />
      </div>
    ),
  ],
  args: {
    id: 'confirm-message',
    status: 'none',
  },
} satisfies Meta<typeof PasswordConfirmMessage>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const None: Story = {};

export const Match: Story = {
  args: { status: 'match' },
};

export const Mismatch: Story = {
  args: { status: 'mismatch' },
};

export const Required: Story = {
  args: { status: 'required' },
};
