import type { Meta, StoryObj } from '@storybook/react';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { Button } from '@/shared/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Elements/TooltipWrapper',
  component: TooltipWrapper,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  argTypes: {
    content: { control: 'text' },
    disabled: { control: 'boolean' },
    className: { control: 'text' },
  },
  args: {
    content: 'This is a tooltip',
    disabled: false,
    children: <Button variant="outline">Hover me</Button>,
  },
} satisfies Meta<typeof TooltipWrapper>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoTooltip: Story = {
  args: {
    content: '',
  },
};

export const WithDisabledButton: Story = {
  args: {
    content: 'This action is not available',
    disabled: true,
    children: (
      <Button variant="outline" disabled>
        Disabled Button
      </Button>
    ),
  },
};

export const WithTextContent: Story = {
  args: {
    content: 'Tooltip with longer descriptive text',
    children: <span className="underline decoration-dotted cursor-help">Hover for info</span>,
  },
};
