import type { Meta, StoryObj } from '@storybook/react';
import { Kbd, KbdGroup } from '@/shared/ui/atoms/kbd';

const meta = {
  title: 'Shared/UI/Atoms/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text' },
  },
} satisfies Meta<typeof Kbd>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'K',
  },
};

export const Command: Story = {
  args: {
    children: '⌘K',
  },
};

export const Combination: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
};

export const ComplexCombination: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>Shift</Kbd>
      <Kbd>L</Kbd>
    </KbdGroup>
  ),
};
