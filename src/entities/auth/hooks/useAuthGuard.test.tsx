import { describe, it, expect, afterEach, vi } from 'vitest';
import { useLocation } from 'react-router-dom';
import { act, renderHookWithDataRouter } from '@/test/utils';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useAuthStore } from '@/shared/store/auth.store';
import {
  SIGNED_OUT_IN_PLACE_DIALOG_STATE,
  useLoginDialogStore,
} from '@/shared/store/loginDialog.store';
import { NavigationService } from '@/shared/lib/router/navigation';

// 로그인 창을 여는 쪽이 라우터가 가 있는 위치를 읽으므로(useBackClosableOverlay) 앱과 같은 데이터 라우터로 그린다.
// 화면에 반영된 위치(useLocation)를 함께 돌려받아 location.state.loginDialogOpen으로 창이 열렸는지 본다.
function renderAuthGuard() {
  return renderHookWithDataRouter(() => ({ guard: useAuthGuard(), location: useLocation() }));
}

function isLoginDialogOpen(location: ReturnType<typeof useLocation>) {
  return Boolean((location.state as { loginDialogOpen?: boolean } | null)?.loginDialogOpen);
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
    const { result } = renderAuthGuard();

    act(() => result.current.guard(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(isLoginDialogOpen(result.current.location)).toBe(false);
  });

  it('비로그인이면 action을 실행하지 않고 로그인 모달을 연다', () => {
    const action = vi.fn();
    const { result } = renderAuthGuard();

    act(() => result.current.guard(action));

    expect(action).not.toHaveBeenCalled();
    expect(isLoginDialogOpen(result.current.location)).toBe(true);
  });

  it('비로그인이면 이전에 남아있던 로그인 성공 콜백을 비운다', () => {
    const staleCallback = vi.fn();
    useLoginDialogStore.getState().setOnSuccess(staleCallback);
    const { result } = renderAuthGuard();

    act(() => result.current.guard(vi.fn()));

    expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
  });

  it('resumeAfterLogin이면 action을 pendingAction에 싣는다', () => {
    const action = vi.fn();
    const { result } = renderAuthGuard();

    act(() => result.current.guard(action, { resumeAfterLogin: true }));

    expect(useLoginDialogStore.getState().pendingAction).toBe(action);
  });

  it('resumeAfterLogin이 아니면 pendingAction을 싣지 않고, 남아있던 것도 비운다', () => {
    const staleAction = vi.fn();
    useLoginDialogStore.getState().setPendingAction(staleAction);
    const { result } = renderAuthGuard();

    act(() => result.current.guard(vi.fn()));

    expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
  });

  it('로그인이 풀린 채 쓰던 화면에 남아 있으면 action을 실행하지 않고 그 이유의 로그인 창을 연다', () => {
    // 로그인이 풀렸을 때 뜬 창과 같은 창 - 닫은 뒤 다시 눌러도 같은 제목으로 뜬다(AuthUtil.openSignInDialogInPlace)
    const navigateSpy = vi.spyOn(NavigationService, 'navigate').mockImplementation(() => {});
    const staleCallback = vi.fn();
    useLoginDialogStore.getState().setOnSuccess(staleCallback);
    useAuthStore.getState().clearLocalAuthInPlace(window.location.pathname);
    const action = vi.fn();
    const { result } = renderAuthGuard();

    act(() => result.current.guard(action));

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
    const { result } = renderAuthGuard();

    act(() => result.current.guard(action, { resumeAfterLogin: true }));

    expect(action).not.toHaveBeenCalled();
    expect(useLoginDialogStore.getState().pendingAction).toBe(action);
  });
});
