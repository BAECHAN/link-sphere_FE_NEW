import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchInput } from '@/shared/ui/elements/SearchInput';

const meta = {
  title: 'Shared/UI/Elements/SearchInput',
  component: SearchInput,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    shortcut: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: {
    placeholder: 'Search...',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchInput>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithShortcut: Story = {
  args: {
    shortcut: 'K',
    placeholder: 'Search... (press K)',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: 'Search disabled',
  },
};

function ControlledSearchInput() {
  const [value, setValue] = useState('');
  return (
    <SearchInput
      value={value}
      onChange={(e) => setValue(e.target.value)}
      shortcut="K"
      placeholder="Search with shortcut..."
    />
  );
}

export const Interactive: Story = {
  render: () => <ControlledSearchInput />,
};
