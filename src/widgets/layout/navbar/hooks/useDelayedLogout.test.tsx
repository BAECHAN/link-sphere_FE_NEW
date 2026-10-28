import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { hasUnsavedChanges, useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { useAlertStore } from '@/shared/ui/elements/dialog/alert/alert.store';
import { useDelayedLogout } from '@/widgets/layout/navbar/hooks/useDelayedLogout';

const logoutSpy = vi.fn();
const navigateSpy = vi.fn();

vi.mock('@/entities/auth/hooks/useAuth', () => ({
  useAuth: () => ({ logout: logoutSpy }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const LOGOUT_DELAY_MS = 700;

function getOpenConfirm() {
  return useAlertStore.getState().alerts.find((alert) => alert.isOpen);
}

describe('useDelayedLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logoutSpy.mockClear();
    navigateSpy.mockClear();
    useAlertStore.setState({ alerts: [] });
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
    window.history.replaceState(null, '', '/post/post-1');
  });

  afterEach(() => {
    vi.useRealTimers();
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
    window.history.replaceState(null, '', '/');
  });

  it('쓰는 중이 아니면 묻지 않고 잠깐 뒤 로그아웃한다 - 화면은 옮기지 않는다', async () => {
    const { result } = renderHook(() => useDelayedLogout());

    act(() => {
      void result.current.handleLogout();
    });

    expect(getOpenConfirm()).toBeUndefined();
    expect(result.current.isLoggingOut).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOGOUT_DELAY_MS);
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(result.current.isLoggingOut).toBe(false);
  });

  it('쓰는 중이면 먼저 확인하고, 취소(계속 작성)하면 아무것도 하지 않는다', async () => {
    useUnsavedChangesStore.getState().markDirty('comment-create:post-1');
    const { result } = renderHook(() => useDelayedLogout());

    act(() => {
      void result.current.handleLogout();
    });

    const confirm = getOpenConfirm();
    expect(confirm).toMatchObject({
      type: 'confirm',
      title: TEXTS.unsavedChanges.logout.title,
      message: TEXTS.unsavedChanges.logout.message,
      confirmText: TEXTS.unsavedChanges.logout.confirm,
      cancelText: TEXTS.unsavedChanges.logout.cancel,
    });
    // 강조는 이탈 확인창과 같은 기본값(취소)이다
    expect(confirm?.emphasis).toBeUndefined();

    act(() => {
      useAlertStore.getState().cancelAlert(confirm!.id);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOGOUT_DELAY_MS);
    });

    expect(logoutSpy).not.toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(hasUnsavedChanges()).toBe(true);
  });

  it('확인하면 쓰던 글의 등록을 비우고 로그아웃한 뒤, 공개 화면이면 피드로 간다', async () => {
    useUnsavedChangesStore.getState().markDirty('comment-create:post-1');
    const { result } = renderHook(() => useDelayedLogout());

    act(() => {
      void result.current.handleLogout();
    });
    act(() => {
      getOpenConfirm()?.onConfirm?.();
    });

    expect(hasUnsavedChanges()).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOGOUT_DELAY_MS);
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, { replace: true });
  });

  it('확인했을 때 보호 화면이면 직접 옮기지 않는다 - 로그아웃이 피드로 보낸다', async () => {
    window.history.replaceState(null, '', ROUTES_PATHS.POST.SUBMIT);
    useUnsavedChangesStore.getState().markDirty('post-create');
    const { result } = renderHook(() => useDelayedLogout());

    act(() => {
      void result.current.handleLogout();
    });
    act(() => {
      getOpenConfirm()?.onConfirm?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOGOUT_DELAY_MS);
    });

    expect(logoutSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
