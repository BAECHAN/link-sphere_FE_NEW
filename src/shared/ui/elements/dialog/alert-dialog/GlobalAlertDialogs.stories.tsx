import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { GlobalAlertDialogs } from '@/shared/ui/elements/dialog/alert-dialog/GlobalAlertDialogs';
import { useAlertDialog } from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { Button } from '@baechan/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Elements/Dialog/AlertDialog/GlobalAlertDialogs',
  component: GlobalAlertDialogs,
  tags: ['autodocs'],
} satisfies Meta<typeof GlobalAlertDialogs>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

function AlertDemo() {
  const { openAlert } = useAlertDialog();
  return (
    <div className="flex flex-col gap-3">
      <GlobalAlertDialogs />
      <Button
        variant="outline"
        onClick={() =>
          openAlert({
            title: '알림',
            message: '작업이 완료되었습니다.',
          })
        }
      >
        Simple Alert 열기
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          openAlert({
            message: '제목 없이 메시지만 표시됩니다.',
          })
        }
      >
        No-title Alert 열기
      </Button>
    </div>
  );
}

export const Default: Story = {
  render: () => <AlertDemo />,
};

// 확인창 데모 - 모든 확인창이 같은 모양이다. 취소 쪽이 흰색·왼쪽·초기 포커스, 창이 묻는 행동이
// 검은색·오른쪽이고 호출부가 바꿀 수 없다(docs/FE-ARCHITECTURE.md §10, docs/DECISIONS.md 2026-11-19).
function ConfirmDemo() {
  const { openConfirm } = useAlertDialog();
  return (
    <div className="flex flex-col gap-3">
      <GlobalAlertDialogs />
      <Button
        variant="outline"
        onClick={() =>
          openConfirm({
            title: '삭제 확인',
            message: '정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
            confirmText: '삭제',
            cancelText: '취소',
          })
        }
      >
        Confirm 열기
      </Button>
    </div>
  );
}

export const Confirm: Story = {
  render: () => <ConfirmDemo />,
  // 실제 브라우저에서만 볼 수 있는 자리·색을 본다. DOM 순서·Enter·Esc·X는 단위 테스트
  // (GlobalAlertDialogs.test.tsx "기본 규칙")가 본다.
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm 열기' }));

    // 확인창은 body로 포털돼 canvas 밖에 그려진다
    const dialog = await within(document.body).findByRole('alertdialog');
    const cancelButton = within(dialog).getByRole('button', { name: '취소' });
    const confirmButton = within(dialog).getByRole('button', { name: '삭제' });

    await expect(cancelButton.getBoundingClientRect().left).toBeLessThan(
      confirmButton.getBoundingClientRect().left
    );

    // 채움 색은 값을 적지 않고 토큰(--primary)에서 읽는다 - 테마가 바뀌어도 "어느 쪽이 채움인가"만 본다
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--primary)';
    document.body.append(probe);
    const filledColor = getComputedStyle(probe).backgroundColor;
    probe.remove();

    await expect(getComputedStyle(confirmButton).backgroundColor).toBe(filledColor);
    await expect(getComputedStyle(cancelButton).backgroundColor).not.toBe(filledColor);
    await waitFor(() => expect(cancelButton).toHaveFocus());
  },
};

function MultipleAlertDialogsDemo() {
  const { openAlert, openConfirm } = useAlertDialog();
  return (
    <div className="flex flex-wrap gap-3">
      <GlobalAlertDialogs />
      <Button variant="outline" onClick={() => openAlert({ message: '첫 번째 알림' })}>
        Alert 1
      </Button>
      <Button variant="outline" onClick={() => openAlert({ message: '두 번째 알림' })}>
        Alert 2
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          openConfirm({
            title: '확인',
            message: '계속하시겠습니까?',
          })
        }
      >
        Confirm
      </Button>
    </div>
  );
}

export const MultipleAlertDialogs: Story = {
  render: () => <MultipleAlertDialogsDemo />,
};
