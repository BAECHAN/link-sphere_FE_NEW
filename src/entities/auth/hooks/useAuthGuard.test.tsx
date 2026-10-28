import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useAuthStore } from '@/shared/store/auth.store';
import {
  SIGNED_OUT_IN_PLACE_DIALOG_STATE,
  useLoginDialogStore,
} from '@/shared/store/loginDialog.store';
import { NavigationService } from '@/shared/lib/router/navigation';

/** location.state.loginDialogOpen 여부를 화면에 노출해 확인한다 (NavbarSearch.test.tsx 선례). */
function LoginDialogStateProbe() {
  const location = useLocation();
  const state = location.state as { loginDialogOpen?: boolean } | null;
  return <div data-testid="login-dialog-open">{String(Boolean(state?.loginDialogOpen))}</div>;
}

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        {children}
        <LoginDialogStateProbe />
      </MemoryRouter>
    );
  };
}

describe('useAuthGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().clearAuth();
    useLoginDialogStore.getState().setOnSuccess(undefined);
    useLoginDialogStore.getState().setPendingAction(undefined);
  });

  it('로그인 상태면 action을 그대로 실행한다', () => {
    useAuthStore.getState().setAuth('token');
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    act(() => result.current(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-dialog-open')).toHaveTextContent('false');
  });

  it('비로그인이면 action을 실행하지 않고 로그인 모달을 연다', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    act(() => result.current(action));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-dialog-open')).toHaveTextContent('true');
  });

  it('비로그인이면 이전에 남아있던 로그인 성공 콜백을 비운다', () => {
    const staleCallback = vi.fn();
    useLoginDialogStore.getState().setOnSuccess(staleCallback);
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    result.current(vi.fn());

    expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
  });

  it('resumeAfterLogin이면 action을 pendingAction에 싣는다', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    result.current(action, { resumeAfterLogin: true });

    expect(useLoginDialogStore.getState().pendingAction).toBe(action);
  });

  it('resumeAfterLogin이 아니면 pendingAction을 싣지 않고, 남아있던 것도 비운다', () => {
    const staleAction = vi.fn();
    useLoginDialogStore.getState().setPendingAction(staleAction);
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    result.current(vi.fn());

    expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
  });

  it('로그인이 풀린 채 쓰던 화면에 남아 있으면 action을 실행하지 않고 그 이유의 로그인 창을 연다', () => {
    // 로그인이 풀렸을 때 뜬 창과 같은 창 - 닫은 뒤 다시 눌러도 같은 제목으로 뜬다(AuthUtil.openSignInDialogInPlace)
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const staleCallback = vi.fn();
    useLoginDialogStore.getState().setOnSuccess(staleCallback);
    useAuthStore.getState().clearLocalAuthInPlace(window.location.pathname);
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    act(() => result.current(action));

    expect(action).not.toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(
      window.location.pathname,
      expect.objectContaining({ state: SIGNED_OUT_IN_PLACE_DIALOG_STATE.signedOutElsewhere })
    );
    expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
  });

  it('로그인이 풀린 채 남아 있어도 resumeAfterLogin이면 창을 연 뒤 action을 pendingAction에 싣는다', () => {
    vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    useAuthStore.getState().expireSession(window.location.pathname);
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    act(() => result.current(action, { resumeAfterLogin: true }));

    expect(action).not.toHaveBeenCalled();
    expect(useLoginDialogStore.getState().pendingAction).toBe(action);
  });
});
