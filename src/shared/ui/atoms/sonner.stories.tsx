import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { toast } from '@/shared/lib/toast/toast';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';

const meta = {
  title: 'Shared/UI/Atoms/Sonner',
  component: Toaster,
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-2 pointer-events-auto">
      {/* Note here: Toaster renders a fixed overlay. In Storybook docs mode this might overlap other things.
           But it's essential to see how it looks. */}
      <Toaster />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            toast('Event has been created', {
              description: 'Sunday, December 03, 2023 at 9:00 AM',
              action: {
                label: 'Undo',
                onClick: () => console.log('Undo'),
              },
            })
          }
        >
          Show Toast
        </Button>
        <Button variant="outline" onClick={() => toast.success('Event has been created')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.info('Event description message')}>
          Info
        </Button>
        <Button variant="outline" onClick={() => toast.error('Event has not been created')}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning('Event has been warning')}>
          Warning
        </Button>
      </div>
    </div>
  ),
};

// 래퍼(shared/lib/toast/toast.ts)가 문장 끝에서 줄을 바꾼다 - 두 문장은 문장마다 한 줄,
// 한 줄보다 긴 문장(마지막 버튼)은 그 문장 안에서만 다시 줄이 바뀐다
const SENTENCE_LINE_BREAKS = [
  { label: '두 문장 (info)', show: () => toast.info(TEXTS.messages.info.sessionExpired) },
  { label: '두 문장 (success)', show: () => toast.success(TEXTS.messages.success.signUpCompleted) },
  {
    label: '두 문장 (error)',
    show: () => toast.error(TEXTS.messages.error.postSubmit.urlInvalid),
  },
  { label: '세 문장 (긴 문장)', show: () => toast.error(TEXTS.messages.error.edgeBlocked) },
];

export const SentenceLineBreak: Story = {
  render: () => (
    <div className="flex flex-col gap-2 pointer-events-auto">
      <Toaster />
      <div className="flex flex-wrap gap-2">
        {SENTENCE_LINE_BREAKS.map(({ label, show }) => (
          <Button key={label} variant="outline" onClick={show}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  ),
};
