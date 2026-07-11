import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { PasswordInput } from '@/shared/ui/elements/PasswordInput';

const meta = {
  title: 'Shared/UI/Elements/PasswordInput',
  component: PasswordInput,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    placeholder: '비밀번호를 입력하세요',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PasswordInput>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 'password1234',
  },
};

function ControlledPasswordInput() {
  const [value, setValue] = useState('');
  return (
    <PasswordInput
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="눈 아이콘으로 표시/숨김 전환"
    />
  );
}

export const Interactive: Story = {
  render: () => <ControlledPasswordInput />,
};
