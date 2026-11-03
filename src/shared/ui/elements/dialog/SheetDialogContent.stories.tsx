import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Dialog,
  DialogClose,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/atoms/dialog';
import { SheetDialogContent } from '@/shared/ui/elements/dialog/SheetDialogContent';
import { Button } from '@/shared/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Elements/Dialog/SheetDialogContent',
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

/** 닫기를 눌러 딤(32%)과 시트가 같은 300ms 곡선으로 함께 사라지는지 본다 — 딤이 먼저 밝아지면 회귀다 */
export const MobileBottomSheetClose: Story = {
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
          <DialogTitle>모바일: 딤과 시트가 함께 닫힘</DialogTitle>
        </DialogHeader>
        <div className="p-4 pt-0">
          <DialogClose asChild>
            <Button className="w-full">닫기</Button>
          </DialogClose>
        </div>
      </SheetDialogContent>
    </Dialog>
  ),
};
