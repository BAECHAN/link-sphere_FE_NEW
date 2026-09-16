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
  // --muted-foreground(#737373)가 --muted 배경(#f5f5f5)에서 4.34:1로 WCAG AA
  // 기준(4.5:1)에 살짝 못 미친다 - 이 토큰이 앱 전역에서 널리 쓰여 값 조정은
  // 시각 변경 승인이 필요하다(2026-09-16 a11y 게이트 실측, docs/DESIGN-SYSTEM.md
  // §11 잔여 목록 참고).
  parameters: { a11y: { test: 'todo' } },
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
  // Command 스토리와 같은 이유(--muted-foreground 대비 미달)
  parameters: { a11y: { test: 'todo' } },
};
