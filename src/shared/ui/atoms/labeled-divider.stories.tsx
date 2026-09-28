import type { Meta, StoryObj } from '@storybook/react';
import { LabeledDivider } from '@/shared/ui/atoms/labeled-divider';

const meta = {
  title: 'Shared/UI/Atoms/LabeledDivider',
  component: LabeledDivider,
  tags: ['autodocs'],
  args: {
    children: '메일이 안 왔나요',
  },
} satisfies Meta<typeof LabeledDivider>;

// eslint-disable-next-line import/no-default-export
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-80">
      <LabeledDivider {...args} />
    </div>
  ),
};
