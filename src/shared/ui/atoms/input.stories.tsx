import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/shared/ui/atoms/input';
// Label import removed as it was unused

// Create a wrapper component to demonstrate Label + Input combination since they are often used together
// referencing Label though it might not have stories yet, it exists in the directory.
// Actually, for pure unit story of Input, we can just use Input.
// But context makes it look better.

const meta = {
  title: 'Shared/UI/Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'password', 'email', 'number', 'date', 'file'],
    },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  args: {
    type: 'text',
    placeholder: 'Type something...',
  },
} satisfies Meta<typeof Input>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Password',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Email',
  },
};

export const File: Story = {
  args: {
    type: 'file',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'Disabled input',
  },
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <label
        htmlFor="email"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Email
      </label>
      <Input {...args} id="email" />
    </div>
  ),
};
