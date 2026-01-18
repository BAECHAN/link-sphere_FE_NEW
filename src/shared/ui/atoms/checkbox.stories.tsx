import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from '@/shared/ui/atoms/checkbox';
import { Label } from '@/shared/ui/atoms/label';

// Wrapper for Checked state handling
import { useState } from 'react';

const CheckboxWithState = (args: any) => {
  const [checked, setChecked] = useState<boolean | 'indeterminate'>(false);
  return (
    <div className="flex items-center space-x-2">
      <Checkbox id="terms" checked={checked} onCheckedChange={setChecked} {...args} />
      <Label htmlFor="terms">Accept terms and conditions</Label>
    </div>
  );
};

const meta = {
  title: 'Shared/UI/Atoms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Checkbox>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

// Interactive story
export const Default: Story = {
  render: (args) => <CheckboxWithState {...args} />,
};

export const Checked: Story = {
  render: (args) => (
    <div className="flex items-center space-x-2">
      <Checkbox id="checked" {...args} checked />
      <Label htmlFor="checked">Checked option</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="disabled" disabled />
      <Label htmlFor="disabled">Disabled option</Label>
    </div>
  ),
};

export const DisabledChecked: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Checkbox id="disabled-checked" disabled checked />
      <Label htmlFor="disabled-checked">Disabled Checked option</Label>
    </div>
  ),
};
