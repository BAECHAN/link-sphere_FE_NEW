import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@/test/utils';
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
