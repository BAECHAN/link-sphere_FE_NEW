import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlert, useAlertStore } from '@/shared/ui/elements/dialog/alert/alert.store';

describe('useAlert', () => {
  beforeEach(() => {
    useAlertStore.setState({ alerts: [] });
  });

  it('알림이 열리고 닫혀도(alerts 변경) 이 훅을 쓰는 컴포넌트는 다시 렌더되지 않는다', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;

      return useAlert();
    });

    expect(renderCount).toBe(1);

    act(() => {
      result.current.openConfirm({ message: 'confirm' });
    });

    const id = useAlertStore.getState().alerts[0]?.id ?? '';

    act(() => {
      useAlertStore.getState().close(id);
    });

    expect(useAlertStore.getState().alerts).toHaveLength(1);
    expect(renderCount).toBe(1);
  });
});
