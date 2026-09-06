import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { FilterChip } from '@/shared/ui/elements/FilterChip';

const meta = {
  title: 'Shared/UI/Elements/FilterChip',
  component: FilterChip,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    isActive: { control: 'boolean' },
  },
  args: {
    label: '북마크한',
    isActive: false,
    activeClassName: 'bg-primary text-primary-foreground',
    onClick: () => {},
  },
} satisfies Meta<typeof FilterChip>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = {
  args: {
    isActive: true,
  },
};

export const ActiveVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <FilterChip
        label="카테고리"
        isActive
        activeClassName="bg-primary text-primary-foreground"
        onClick={() => {}}
      />
      <FilterChip
        label="북마크한"
        isActive
        activeClassName="bg-warning text-warning-foreground"
        onClick={() => {}}
      />
      <FilterChip
        label="내가 작성한"
        isActive
        activeClassName="bg-info text-info-foreground"
        onClick={() => {}}
      />
      <FilterChip
        label="나만 볼 수 있는"
        isActive
        activeClassName="bg-category text-category-foreground"
        onClick={() => {}}
      />
    </div>
  ),
};

function ToggleableChip() {
  const [isActive, setIsActive] = useState(false);
  return (
    <FilterChip
      label="북마크한"
      isActive={isActive}
      activeClassName="bg-primary text-primary-foreground"
      onClick={() => setIsActive((prev) => !prev)}
    />
  );
}

export const Interactive: Story = {
  render: () => <ToggleableChip />,
};
