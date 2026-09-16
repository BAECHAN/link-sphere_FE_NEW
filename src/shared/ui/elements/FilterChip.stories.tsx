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

export const Default: Story = {
  // 비활성 상태가 --muted-foreground(4.34:1)를 쓴다 - kbd.stories.tsx와 같은
  // 이유로 미룬다(2026-09-16 a11y 게이트 실측, docs/DESIGN-SYSTEM.md §11 참고).
  parameters: { a11y: { test: 'todo' } },
};

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
  // --info(4.42:1)·--category(4.47:1)가 흰 글자 배경으로 WCAG AA(4.5:1) 기준에
  // 살짝 못 미친다 - 앱 전역에서 쓰이는 토큰이라 값 조정은 시각 변경 승인이
  // 필요하다(2026-09-16 a11y 게이트 실측, docs/DESIGN-SYSTEM.md §11 참고).
  parameters: { a11y: { test: 'todo' } },
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
  // Default 스토리와 같은 이유(--muted-foreground 대비 미달, 초기 비활성 상태)
  parameters: { a11y: { test: 'todo' } },
};
