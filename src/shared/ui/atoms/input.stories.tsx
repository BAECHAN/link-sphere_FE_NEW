import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
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
      options: ['text', 'email', 'number', 'date', 'file'],
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

function WithClearStory() {
  const [value, setValue] = useState('지울 수 있는 값');
  return (
    <div className="relative w-full max-w-sm">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClear={() => setValue('')}
        placeholder="입력 후 X 버튼으로 지울 수 있습니다."
      />
    </div>
  );
}

export const WithClear: Story = {
  render: () => <WithClearStory />,
};

// value를 받지 않는 비제어 입력(RHF register 등)은 값 유무를 hasValue로 따로 알려야 X가 보인다
function UncontrolledWithClearStory() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasValue, setHasValue] = useState(true);
  return (
    <div className="relative w-full max-w-sm">
      <Input
        ref={inputRef}
        defaultValue="지울 수 있는 값"
        hasValue={hasValue}
        onChange={(e) => setHasValue(e.target.value !== '')}
        onClear={() => {
          if (inputRef.current) {
            inputRef.current.value = '';
          }

          setHasValue(false);
        }}
        placeholder="입력 후 X 버튼으로 지울 수 있습니다."
      />
    </div>
  );
}

export const UncontrolledWithClear: Story = {
  render: () => <UncontrolledWithClearStory />,
};
