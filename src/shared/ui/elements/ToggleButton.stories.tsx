import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';

const meta = {
  title: 'Shared/UI/Elements/ToggleButton',
  component: ToggleButton,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'none'],
    },
    disabled: { control: 'boolean' },
  },
  args: {
    variant: 'outline',
    children: '토글',
  },
} satisfies Meta<typeof ToggleButton>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function CountingToggleButton() {
  const [isOn, setIsOn] = useState(false);
  const [count, setCount] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <ToggleButton
        variant="ghost"
        size="icon"
        onClick={() => {
          setIsOn((prev) => !prev);
          setCount((prev) => prev + 1);
        }}
      >
        {isOn ? <EyeOff /> : <Eye />}
        <span className="sr-only">표시 전환</span>
      </ToggleButton>
      <span className="text-sm text-muted-foreground">
        더블클릭해도 한 번만 바뀐다 — 전환 횟수: {count}
      </span>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <CountingToggleButton />,
};
