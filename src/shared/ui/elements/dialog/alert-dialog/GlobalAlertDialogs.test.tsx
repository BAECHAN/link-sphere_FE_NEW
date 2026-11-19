import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, userEvent, waitFor, within } from '@/test/utils';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import {
  getOpenAlertDialogId,
  useAlertDialogStore,
} from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { GlobalAlertDialogs } from '@/shared/ui/elements/dialog/alert-dialog/GlobalAlertDialogs';

// 이 부품은 라우터를 모른다 - 모두 라우터 없이 그린다. 라우터 위치와 이은 동작은
// RouteAlertDialogs.test.tsx가 본다.

const CONFIRM_MESSAGE = 'confirm-message';

function openConfirm(onCancel?: () => void) {
  act(() => {
    useAlertDialogStore.getState().openConfirm({ message: CONFIRM_MESSAGE, onCancel });
  });
}

describe('GlobalAlertDialogs dismissKey', () => {
  beforeEach(() => {
    useAlertDialogStore.setState({ dialogs: [] });
  });

  it('확인창이 열린 뒤 dismissKey가 바뀌면 취소로 닫힌다', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<GlobalAlertDialogs dismissKey="a" />);

    openConfirm(onCancel);
    await screen.findByText(CONFIRM_MESSAGE);

    rerender(<GlobalAlertDialogs dismissKey="b" />);

    expect(getOpenAlertDialogId()).toBeNull();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dismissKey가 그대로면 다시 그려도 열려 있다', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<GlobalAlertDialogs dismissKey="a" />);

    openConfirm(onCancel);
    await screen.findByText(CONFIRM_MESSAGE);

    rerender(<GlobalAlertDialogs dismissKey="a" />);

    expect(getOpenAlertDialogId()).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('dismissKey를 넘기지 않으면 라우터 없이도 그려지고 다시 그려도 열려 있다', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<GlobalAlertDialogs />);

    openConfirm(onCancel);
    await screen.findByText(CONFIRM_MESSAGE);

    rerender(<GlobalAlertDialogs />);

    expect(getOpenAlertDialogId()).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

// 확인창(Confirm)의 모양과 기본 동작은 호출부가 바꿀 수 없다 - 취소 쪽이 왼쪽(DOM에서 앞)이고
// 초기 포커스를 받으며, Enter·Esc·X는 모두 취소다(docs/FE-ARCHITECTURE.md §10,
// docs/DECISIONS.md 2026-11-19). 뒤로가기(dismissKey)는 위 describe가 본다. 실제 색과 좌표는
// jsdom이 계산하지 못해 GlobalAlertDialogs.stories.tsx의 Confirm 스토리 play가 본다.
describe('GlobalAlertDialogs 기본 규칙', () => {
  const CONFIRM_TEXT = 'confirm-action';

  beforeEach(() => {
    useAlertDialogStore.setState({ dialogs: [] });
    // 열린 직후 클릭 가드(alert-dialog.tsx)의 시계만 가짜로 돌린다(alert-dialog.test.tsx와 같다)
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function renderOpenConfirm(cancelText?: string) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<GlobalAlertDialogs />);

    act(() => {
      useAlertDialogStore.getState().openConfirm({
        message: CONFIRM_MESSAGE,
        confirmText: CONFIRM_TEXT,
        cancelText,
        onConfirm,
        onCancel,
      });
    });

    const dialog = await screen.findByRole('alertdialog');

    return { dialog, onConfirm, onCancel };
  }

  it('취소 버튼이 확인 버튼보다 앞(왼쪽)에 있다', async () => {
    const { dialog } = await renderOpenConfirm();

    const cancelButton = within(dialog).getByRole('button', { name: TEXTS.buttons.cancel });
    const confirmButton = within(dialog).getByRole('button', { name: CONFIRM_TEXT });

    expect(
      cancelButton.compareDocumentPosition(confirmButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('열리면 취소 버튼에 포커스가 있다', async () => {
    const { dialog } = await renderOpenConfirm();

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: TEXTS.buttons.cancel })).toHaveFocus()
    );
  });

  it('가드 시간이 지난 뒤 Enter를 누르면 취소만 실행된다', async () => {
    const user = userEvent.setup();
    const { dialog, onConfirm, onCancel } = await renderOpenConfirm();

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: TEXTS.buttons.cancel })).toHaveFocus()
    );

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    await user.keyboard('{Enter}');

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Esc를 누르면 취소가 실행된다', async () => {
    const { dialog, onConfirm, onCancel } = await renderOpenConfirm();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('닫기(X)를 누르면 취소가 실행된다', async () => {
    const { dialog, onConfirm, onCancel } = await renderOpenConfirm();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.click(within(dialog).getByRole('button', { name: TEXTS.ariaLabels.close }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('취소 버튼 이름은 넘기지 않으면 "취소"이고, 넘기면 그 문구다', async () => {
    const { dialog } = await renderOpenConfirm(TEXTS.unsavedChanges.signup.cancel);

    expect(
      within(dialog).getByRole('button', { name: TEXTS.unsavedChanges.signup.cancel })
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: TEXTS.buttons.cancel })
    ).not.toBeInTheDocument();
  });

  it('버튼이 하나인 알림은 확인 버튼에 포커스가 있다', async () => {
    render(<GlobalAlertDialogs />);

    act(() => {
      useAlertDialogStore.getState().openAlert({ message: CONFIRM_MESSAGE });
    });

    const dialog = await screen.findByRole('alertdialog');

    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: TEXTS.buttons.confirm })).toHaveFocus()
    );
  });
});
