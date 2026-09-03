import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from '@/shared/ui/atoms/switch';
import { useState } from 'react';

const SwitchWithState = (args: React.ComponentProps<typeof Switch>) => {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Switch id="airplane-mode" checked={checked} onCheckedChange={setChecked} {...args} />
      <label htmlFor="airplane-mode">Airplane mode</label>
    </div>
  );
};

const meta = {
  title: 'Shared/UI/Atoms/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Switch>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <SwitchWithState {...args} />,
};

export const Checked: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <Switch id="checked" {...args} checked />
      <label htmlFor="checked">Checked</label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="disabled" disabled />
      <label htmlFor="disabled">Disabled</label>
    </div>
  ),
};

export const DisabledChecked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="disabled-checked" disabled checked />
      <label htmlFor="disabled-checked">Disabled Checked</label>
    </div>
  ),
};
