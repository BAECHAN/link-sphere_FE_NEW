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

const LONG_ROWS = Array.from({ length: 30 }, (_, i) => `항목 ${i + 1}`);

/**
 * 내용이 길 때 창 전체가 보이는 화면의 70%(데스크톱은 화면 높이 − 2rem)에서 멈추고, 위아래 고정 줄 사이의
 * 스크롤 영역만 줄어드는지 본다 — 제목이나 아래 버튼이 화면 밖으로 밀리면 회귀다
 */
export const MobileBottomSheetLongContent: Story = {
  args: {
    isMobile: true,
  },
  render: (args) => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">시트 열기</Button>
      </DialogTrigger>
      <SheetDialogContent isMobile={args.isMobile}>
        <DialogHeader className="border-b p-4">
          <DialogTitle>내용이 길어도 화면 안</DialogTitle>
        </DialogHeader>
        <ul className="min-h-0 overflow-y-auto py-1">
          {LONG_ROWS.map((row) => (
            <li key={row}>
              <Button variant="ghost" className="w-full justify-start rounded-none px-4">
                {row}
              </Button>
            </li>
          ))}
        </ul>
        <div className="border-t p-3">
          <DialogClose asChild>
            <Button className="w-full">확인</Button>
          </DialogClose>
        </div>
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
