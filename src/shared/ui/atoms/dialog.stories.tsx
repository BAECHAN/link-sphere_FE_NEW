import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/shared/ui/atoms/dialog';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Label } from '@/shared/ui/atoms/label';

const meta = {
  title: 'Shared/UI/Atoms/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue="Pedro Duarte" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input id="username" defaultValue="@peduarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/**
 * dismissOnOutsideClick={false} — 바깥(오버레이) 클릭으로 닫히지 않는다. ESC·닫기 버튼으로만
 * 닫힌다. 입력이 생긴 로그인 모달이 쓴다(docs/DECISIONS.md 2026-09-30). 확인창(Alert/Confirm)은
 * 이 prop 대신 AlertDialog(alert-dialog.stories.tsx)가 같은 동작을 한다.
 */
export const NoOutsideDismiss: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dismissOnOutsideClick={false}>
        <DialogHeader>
          <DialogTitle>Outside click is ignored</DialogTitle>
          <DialogDescription>Close with Escape or the close button.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};
