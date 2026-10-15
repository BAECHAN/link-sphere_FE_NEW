import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { createTestQueryClient } from '@/test/utils';

// AuthUtil이 import하는 NavigationService는 이 파일 안에서만 모킹한다(auth.util.test.ts와 같은 이유)
vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: { navigate: vi.fn(), setNavigate: vi.fn() },
}));

import { NavigationService } from '@/shared/lib/router/navigation';
import { AuthUtil } from '@/shared/utils/auth.util';
import { useAuthEpochSync } from '@/entities/auth/hooks/useAuthEpochSync';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

/** 이 탭이 로그인한 상태(토큰 + 세션 플래그 + 이 탭이 쓴 세대) */
function signInThisTab(token = 'token-a') {
  useAuthStore.getState().setAuth(token);
  useAuthStore.getState().setAuthResolved(true);
  AuthEpochUtil.markLogin();
}

/** 다른 탭이 로그아웃했다 - 그 탭이 세션 플래그를 지우고 세대를 바꾼 뒤 storage 이벤트가 온다 */
function signOutInOtherTab() {
  LocalStorageUtil.removeItem(STORAGE_KEYS.AUTH.HAS_SESSION);
  LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'out:other-tab');
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.AUTH.EPOCH }));
}

/** 다른 탭이 로그인했다(세션 플래그를 쓴 뒤 세대를 바꿈). dispatch=false면 이벤트 없이 값만 바뀐다(bfcache에 멈춰 있던 사이) */
function signInInOtherTab({ dispatch = true } = {}) {
  LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.HAS_SESSION, true);
  LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab');

  if (dispatch) {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.AUTH.EPOCH }));
  }
}

/** spy는 refresh가 실어 보낸 X-Access-Token(없으면 null)으로 불린다 */
function mockRefresh(accessToken: string | null) {
  const spy = vi.fn();
  server.use(
    http.post(url(API_ENDPOINTS.auth.refresh), ({ request }) => {
      spy(request.headers.get('X-Access-Token'));

      if (!accessToken) {
        return HttpResponse.json(
          { status: 401, code: 'INVALID_REFRESH_TOKEN', message: '', timestamp: '' },
          { status: 401 }
        );
      }

      return HttpResponse.json(
        { status: 200, message: 'ok', data: { accessToken }, timestamp: '' },
        { status: 200 }
      );
    })
  );
  return spy;
}

function restoreFromBfcache() {
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
}

describe('useAuthEpochSync', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/post');
  });

  afterEach(() => {
    vi.clearAllMocks();
    AuthUtil.resetLogoutGuard();
    useAuthStore.getState().setAuthResolved(false);
    useLoginDialogStore.setState({ onSuccess: undefined, pendingAction: undefined });
    window.localStorage.clear();
  });

  it('다른 탭이 로그아웃하면 이 탭도 로그아웃 상태가 되고, 공개 경로에서는 이동하지 않는다', () => {
    signInThisTab();
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signOutInOtherTab();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(NavigationService.navigate).not.toHaveBeenCalled();
  });

  it('다른 탭이 로그아웃했을 때 보호 경로에 있으면 /post로 옮긴다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);
    signInThisTab();
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signOutInOtherTab();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
  });

  it('토큰을 든 살아 있는 탭이 다른 탭의 로그인을 받으면 내보내지 않고 새 세션을 받아들인다', async () => {
    window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);
    signInThisTab('token-a');
    const refresh = mockRefresh('token-b');
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signInInOtherTab();

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-b'));
    expect(refresh).toHaveBeenCalledTimes(1);
    // 들고 있던 토큰을 실어 보내 BE가 같은 회원인지 확인한다
    expect(refresh).toHaveBeenCalledWith('token-a');
    expect(NavigationService.navigate).not.toHaveBeenCalled();
  });

  it('받아들이려던 세션이 다른 계정이면(SESSION_MISMATCH) 로그아웃 처리 뒤 그 계정으로 복원하고 알린다', async () => {
    window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);
    signInThisTab('token-a');
    // BE처럼: 토큰을 실어 보내면(이 탭의 옛 계정) 409, 토큰 없이 보내면 쿠키 주인 계정의 새 토큰
    const hints: Array<string | null> = [];
    server.use(
      http.post(url(API_ENDPOINTS.auth.refresh), ({ request }) => {
        const hint = request.headers.get('X-Access-Token');
        hints.push(hint);

        if (hint) {
          return HttpResponse.json(
            { status: 409, code: 'SESSION_MISMATCH', message: '', timestamp: '' },
            { status: 409 }
          );
        }

        return HttpResponse.json(
          { status: 200, message: 'ok', data: { accessToken: 'token-b' }, timestamp: '' },
          { status: 200 }
        );
      })
    );
    const toastInfo = vi.spyOn(toast, 'info');
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signInInOtherTab();

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-b'));
    expect(hints).toEqual(['token-a', null]);
    // 이전 계정으로 쓰던 보호 화면은 떠난다(bfcache 복원 때와 같은 엄격한 처리)
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
    expect(toastInfo).toHaveBeenCalledWith(TEXTS.messages.info.switchedToOtherAccount);
    toastInfo.mockRestore();
  });

  it('bfcache 복원 때 그 사이 다른 계정이 로그인했으면 로그아웃 처리 뒤 새 세션으로 복원한다', async () => {
    window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);
    signInThisTab('token-a');
    mockRefresh('token-b');
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    // 멈춰 있던 사이라 storage 이벤트를 받지 못했다
    signInInOtherTab({ dispatch: false });
    restoreFromBfcache();

    // 중간에 로그아웃이 있었는지 알 수 없어 엄격하게 - 보호 경로에서 먼저 빠진다
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-b'));
  });

  it('탭이 다시 보일 때도 확인한다 - 숨겨질 때는 확인하지 않는다', () => {
    signInThisTab();
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });
    LocalStorageUtil.removeItem(STORAGE_KEYS.AUTH.HAS_SESSION);
    LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'out:other-tab');
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(useAuthStore.getState().accessToken).toBe('token-a');

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('세대가 그대로면 아무것도 하지 않는다', () => {
    signInThisTab();
    const refresh = mockRefresh('token-b');
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    restoreFromBfcache();

    expect(useAuthStore.getState().accessToken).toBe('token-a');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('로그아웃 상태 탭은 다른 탭의 로그인을 받아 복원하고, 열려 있던 로그인 모달의 재개 동작은 버린다', async () => {
    useAuthStore.getState().setAuthResolved(true);
    const pendingAction = vi.fn();
    const onSuccess = vi.fn();
    useLoginDialogStore.setState({ pendingAction, onSuccess });
    mockRefresh('token-b');
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signInInOtherTab();

    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('token-b'));
    expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
    expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
    expect(pendingAction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('앱 시작 복원이 진행 중이면 복원을 그쪽에 맡긴다', () => {
    const refresh = mockRefresh('token-b');
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signInInOtherTab();

    expect(refresh).not.toHaveBeenCalled();
  });

  it('복원이 실패해도 다른 탭이 쓴 세션 플래그는 지우지 않는다', async () => {
    useAuthStore.getState().setAuthResolved(true);
    const refresh = mockRefresh(null);
    renderHook(() => useAuthEpochSync(), { wrapper: Wrapper });

    signInInOtherTab();

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(LocalStorageUtil.getItem(STORAGE_KEYS.AUTH.HAS_SESSION)).toBe(true);
  });
});
