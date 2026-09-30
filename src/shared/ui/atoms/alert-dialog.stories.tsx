import type { Meta, StoryObj } from '@storybook/react';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/shared/ui/atoms/alert-dialog';
import { Button } from '@/shared/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Atoms/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
} satisfies Meta<typeof AlertDialog>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * role="alertdialog" — 응답이 필요한 확인창 전용. 바깥(오버레이) 클릭으로는 닫히지 않고
 * ESC·닫기 버튼으로 닫힌다. 앱에서는 전역 확인창(`Alert.tsx`)이 이 atom을 쓴다
 * (docs/DECISIONS.md 2026-09-30).
 */
export const Default: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Delete</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[400px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline">Delete</Button>
          <Button>Cancel</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
