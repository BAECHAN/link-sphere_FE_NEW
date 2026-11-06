import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAlertDialog,
  useAlertDialogStore,
} from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';

describe('useAlertDialog', () => {
  beforeEach(() => {
    useAlertDialogStore.setState({ dialogs: [] });
  });

  it('알림이 열리고 닫혀도(dialogs 변경) 이 훅을 쓰는 컴포넌트는 다시 렌더되지 않는다', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;

      return useAlertDialog();
    });

    expect(renderCount).toBe(1);

    act(() => {
      result.current.openConfirm({ message: 'confirm' });
    });

    const id = useAlertDialogStore.getState().dialogs[0]?.id ?? '';

    act(() => {
      useAlertDialogStore.getState().close(id);
    });

    expect(useAlertDialogStore.getState().dialogs).toHaveLength(1);
    expect(renderCount).toBe(1);
  });
});
