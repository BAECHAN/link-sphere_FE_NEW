import type { Meta, StoryObj } from '@storybook/react';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/atoms/button';

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
