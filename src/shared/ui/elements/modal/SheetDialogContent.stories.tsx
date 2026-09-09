import type { Meta, StoryObj } from '@storybook/react';
import { Dialog, DialogTrigger, DialogHeader, DialogTitle } from '@/shared/ui/atoms/dialog';
import { SheetDialogContent } from '@/shared/ui/elements/modal/SheetDialogContent';
import { Button } from '@/shared/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Elements/Modal/SheetDialogContent',
  component: SheetDialogContent,
  tags: ['autodocs'],
  args: {
    isMobile: false,
  },
} satisfies Meta<typeof SheetDialogContent>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  render: (args) => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">모달 열기</Button>
      </DialogTrigger>
      <SheetDialogContent isMobile={args.isMobile}>
        <DialogHeader className="p-4">
          <DialogTitle>데스크탑: 중앙 모달</DialogTitle>
        </DialogHeader>
      </SheetDialogContent>
    </Dialog>
  ),
};

export const MobileBottomSheet: Story = {
  args: {
    isMobile: true,
  },
  render: (args) => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">시트 열기</Button>
      </DialogTrigger>
      <SheetDialogContent isMobile={args.isMobile}>
        <DialogHeader className="p-4">
          <DialogTitle>모바일: 하단 시트</DialogTitle>
        </DialogHeader>
      </SheetDialogContent>
    </Dialog>
  ),
};
