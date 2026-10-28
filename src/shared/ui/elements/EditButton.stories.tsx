import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { EditButton } from '@/shared/ui/elements/EditButton';

const meta = {
  title: 'Shared/UI/Elements/EditButton',
  component: EditButton,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    className: { control: 'text' },
  },
  args: {
    label: '이름 수정',
    onClick: fn(),
  },
} satisfies Meta<typeof EditButton>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NextToTitle: Story = {
  render: (args) => (
    <div className="flex items-center gap-1">
      <h1 className="text-screen-title">자바스크립트 심화 학습 자료</h1>
      <EditButton {...args} />
    </div>
  ),
};
