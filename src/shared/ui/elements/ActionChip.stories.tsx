import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionChip } from '@/shared/ui/elements/ActionChip';

const meta = {
  title: 'Shared/UI/Elements/ActionChip',
  component: ActionChip,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
  },
  args: {
    label: '개발',
    onClick: () => {},
  },
} satisfies Meta<typeof ActionChip>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CategoryColors: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ActionChip
        label="개발"
        labelClassName="border-transparent bg-category-1 text-category-1-foreground"
        onClick={() => {}}
      />
      <ActionChip
        label="디자인"
        labelClassName="border-transparent bg-category-2 text-category-2-foreground"
        onClick={() => {}}
      />
      <ActionChip
        label="AI"
        labelClassName="border-transparent bg-category-3 text-category-3-foreground"
        onClick={() => {}}
      />
    </div>
  ),
};
