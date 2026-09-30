import type { Meta, StoryObj } from '@storybook/react';
import { PasswordRequirementList } from '@/entities/auth/ui/PasswordRequirementList';
import { TEXTS } from '@/shared/config/texts';

const meta = {
  title: 'Entities/Auth/PasswordRequirementList',
  component: PasswordRequirementList,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex w-80 flex-col gap-2">
        <Story />
      </div>
    ),
  ],
  args: {
    id: 'requirements',
    messageId: 'requirements-message',
    states: { minLength: 'pending', letter: 'pending', digit: 'pending', special: 'pending' },
  },
} satisfies Meta<typeof PasswordRequirementList>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Initial: Story = {};

export const Typing: Story = {
  args: {
    states: { minLength: 'pending', letter: 'met', digit: 'met', special: 'pending' },
  },
};

export const UnmetAfterBlur: Story = {
  args: {
    states: { minLength: 'unmet', letter: 'met', digit: 'met', special: 'unmet' },
  },
};

export const AllMet: Story = {
  args: {
    states: { minLength: 'met', letter: 'met', digit: 'met', special: 'met' },
  },
};

export const NonAsciiViolation: Story = {
  args: {
    states: { minLength: 'met', letter: 'met', digit: 'met', special: 'pending' },
    message: TEXTS.validation.passwordAsciiOnly,
  },
};

export const SubmittedEmpty: Story = {
  args: {
    states: { minLength: 'unmet', letter: 'unmet', digit: 'unmet', special: 'unmet' },
    message: TEXTS.validation.passwordRequired,
  },
};
