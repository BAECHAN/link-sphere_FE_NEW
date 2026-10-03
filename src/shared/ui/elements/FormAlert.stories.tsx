import type { Meta, StoryObj } from '@storybook/react-vite';
import { FormAlert } from '@/shared/ui/elements/FormAlert';
import { TEXTS } from '@/shared/config/texts';

const meta = {
  title: 'Shared/UI/Elements/FormAlert',
  component: FormAlert,
  tags: ['autodocs'],
  args: {
    children: TEXTS.messages.error.postSubmit.rateLimitedIn(15),
  },
} satisfies Meta<typeof FormAlert>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongMessageWithLink: Story = {
  args: {
    children: (
      <>
        {TEXTS.messages.error.postSubmit.timeout}{' '}
        <a href="#feed" className="underline underline-offset-2">
          {TEXTS.messages.error.postSubmit.checkFeed}
        </a>
      </>
    ),
  },
};
