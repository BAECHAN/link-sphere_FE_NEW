import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement, Suspense, type ReactNode } from 'react';
import { QueryClientProvider, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/store/auth.store';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { clearUnsavedChanges, useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { RouterEvents } from '@/shared/lib/router/router-events';
import type { Location } from 'react-router-dom';

// AuthUtil이 import하는 queryClient/NavigationService는 이 파일 안에서만 모킹한다 - 전역
// setup.ts에서 AuthUtil을 import하면 이 두 모듈이 각 테스트 파일의 vi.mock보다 먼저 "실제"
// 모듈로 로드·캐시돼버려 이후 어떤 파일의 mock도 적용되지 않는다(auth.util.ts의
// resetLogoutGuard 주석 참고, client.test.ts에서 실측).
vi.mock('@/shared/lib/react-query/config/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return {
    // setQueryData로 캐시를 심고 나중에 getQueryData/queryFn 호출 횟수로 검증하므로
    // gcTime: Infinity가 필요하다(createTestQueryClient 주석과 같은 이유).
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: 0, staleTime: 0, gcTime: Infinity } },
    }),
  };
});
vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: { navigate: vi.fn(), setNavigate: vi.fn() },
}));

import { AuthUtil } from '@/shared/utils/auth.util';

// 위 vi.mock이 이 경로를 격리된 테스트 전용 QueryClient로 통째로 교체했다. 이 import는
// 그 mock 인스턴스를 테스트 단언에서 참조하기 위한 것이지 실제 싱글턴이 아니다
// (auth.util.ts만 예외인 eslint.config.js의 ignores는 프로덕션 코드 기준이라
// 이 파일까지 포함하지 않는다).
// eslint-disable-next-line custom-query-rules/no-query-client-singleton-import
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('AuthUtil.clearAll — 화면이 곧 사라지는 로그아웃(보호 경로·세션 만료)', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
  });

  it('화면에 떠 있는 활성 쿼리를 다시 요청하지 않는다', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useQuery({ queryKey: ['probe'], queryFn }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);

    AuthUtil.clearAll();

    // 재요청이 없다는 걸 "일정 시간 안 나옴"으로 증명할 수는 없으니, 캐시가 실제로
    // 비었는지(재요청됐다면 다시 채워져 있어야 한다)와 호출 횟수 둘 다로 고정한다.
    expect(queryClient.getQueryData(['probe'])).toBeUndefined();
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  });

  it('Suspense 쿼리도 다시 요청하지 않는다', async () => {
    const queryFn = vi.fn(() => Promise.resolve('suspense-data'));

    function SuspenseProbe() {
      const { data } = useSuspenseQuery({ queryKey: ['suspense-probe'], queryFn });
      return createElement('div', null, data);
    }

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Suspense, { fallback: 'loading' }, createElement(SuspenseProbe))
      )
    );

    await screen.findByText('suspense-data');
    expect(queryFn).toHaveBeenCalledTimes(1);

    AuthUtil.clearAll();

    // 컴포넌트는 아직 마운트된 채로 남아있다(실제 앱에서는 이 직후 ProtectedRoute가
    // <Navigate>로 언마운트시킨다 - 여기서는 clearAll() 자체가 재요청을 유발하지
    // 않는다는 것만 고정한다, auth.util.ts의 clearQueriesWithoutRefetch 주석 참고).
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  });

  it('인증을 비우고 지정 경로로 replace 이동한다', () => {
    useAuthStore.getState().setAuth('some-token');

    AuthUtil.clearAll(ROUTES_PATHS.POST.ROOT);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
  });

  it('끝나지 않는 mutation을 mutation 캐시에서 지워 같은 scope의 다음 mutation을 막지 않는다', async () => {
    // 응답이 오지 않는 요청이 줄 맨 앞에 걸려 있는 상황을 재현한다
    const stuck = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => new Promise(() => {}), scope: { id: 'probe' } });
    void stuck.execute(undefined);
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));

    AuthUtil.clearAll();

    expect(queryClient.isMutating()).toBe(0);
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);

    // 같은 scope로 새로 시작한 mutation의 요청이 실제로 나간다
    const mutationFn = vi.fn().mockResolvedValue('ok');
    const next = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn, scope: { id: 'probe' } });
    await next.execute(undefined);
    expect(mutationFn).toHaveBeenCalledTimes(1);
  });
});

describe('AuthUtil.clearQueries — 제자리 로그아웃(비보호 경로)', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
  });

  it('clearAll()과 달리 화면에 떠 있는 활성 쿼리를 다시 요청한다', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useQuery({ queryKey: ['probe'], queryFn }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);

    AuthUtil.clearQueries();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });
});

describe('AuthUtil.isLoggingOut', () => {
  afterEach(() => {
    AuthUtil.resetLogoutGuard();
    vi.useRealTimers();
  });

  it('clearAll() 직후에는 true이고, 유예 시간이 지나면 false로 돌아온다', () => {
    vi.useFakeTimers();

    AuthUtil.clearAll();
    expect(AuthUtil.isLoggingOut()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(AuthUtil.isLoggingOut()).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(AuthUtil.isLoggingOut()).toBe(false);
  });

  it('clearQueries()의 배경 재요청이 끝나면 false로 돌아온다', async () => {
    AuthUtil.clearQueries();
    expect(AuthUtil.isLoggingOut()).toBe(true);

    await waitFor(() => expect(AuthUtil.isLoggingOut()).toBe(false));
  });
});

describe('AuthUtil.applySessionExpired — 로그인 만료를 그 자리에서 알린다', () => {
  const DIRTY_KEY = 'post-create';
  const dialogState = { loginDialogOpen: true, loginDialogReason: 'expired' };
  let toastInfo: MockInstance<typeof toast.info>;

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    toastInfo = vi.spyOn(toast, 'info');
    useAuthStore.getState().setAuth('token-a');
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
    toastInfo.mockRestore();
    clearUnsavedChanges(DIRTY_KEY);
    window.history.replaceState(null, '', '/');
  });

  it('보호 경로면 캐시를 그대로 두고 같은 주소 위에 로그인 창을 연다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.POST.SUBMIT);
    queryClient.setQueryData(['probe'], 'kept');

    AuthUtil.applySessionExpired();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().signedOutInPlace).toEqual({
      reason: 'expired',
      pathname: ROUTES_PATHS.POST.SUBMIT,
    });
    expect(queryClient.getQueryData(['probe'])).toBe('kept');
    expect(NavigationService.navigate).toHaveBeenCalledTimes(1);
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.SUBMIT, {
      state: dialogState,
      replace: false,
      preventScrollReset: true,
    });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('공개 경로에서 쓰는 중이면 비로그인으로 다시 불러오고 로그인 창을 연다', async () => {
    window.history.replaceState(null, '', '/post/post-1');
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);
    const queryFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useQuery({ queryKey: ['probe'], queryFn }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    AuthUtil.applySessionExpired();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(NavigationService.navigate).toHaveBeenCalledWith('/post/post-1', {
      state: dialogState,
      replace: false,
      preventScrollReset: true,
    });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('공개 경로에서 저장 요청이 진행 중이면 로그인 창을 연다', () => {
    window.history.replaceState(null, '', '/post/post-1');
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => new Promise(() => {}) })
      .execute(undefined);

    AuthUtil.applySessionExpired();

    expect(NavigationService.navigate).toHaveBeenCalledWith('/post/post-1', {
      state: dialogState,
      replace: false,
      preventScrollReset: true,
    });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('공개 경로에서 보기만 하던 중이면 닫을 때까지 남는 토스트로 알리고, 그 버튼이 로그인 창을 연다', () => {
    window.history.replaceState(null, '', '/post');

    AuthUtil.applySessionExpired();

    expect(NavigationService.navigate).not.toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalledTimes(1);
    const [message, options] = toastInfo.mock.calls[0]!;
    expect(message).toBe(TEXTS.messages.info.sessionExpired);
    expect(options).toMatchObject({ id: 'session-expired', duration: Infinity });

    const action = options?.action as { label: string; onClick: () => void };
    expect(action.label).toBe(TEXTS.buttons.login);
    action.onClick();

    expect(NavigationService.navigate).toHaveBeenCalledWith('/post', {
      state: dialogState,
      replace: false,
      preventScrollReset: true,
    });
  });

  it('로그인 창에 남아 있던 "로그인 후 할 일"을 비운다 - 만료 뒤 로그인이 이전 창의 일을 실행하지 않게', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.POST.SUBMIT);
    useLoginDialogStore.getState().setPendingAction(vi.fn());
    useLoginDialogStore.getState().setOnSuccess(vi.fn());

    AuthUtil.applySessionExpired();

    expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
    expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
  });

  it('dismissSessionExpiredToast는 그 id의 토스트를 닫는다', () => {
    const dismiss = vi.spyOn(toast, 'dismiss');

    AuthUtil.dismissSessionExpiredToast();

    expect(dismiss).toHaveBeenCalledWith('session-expired');
    dismiss.mockRestore();
  });
});

describe('AuthUtil.notifySessionExpiredOnStart — 앱을 열 때 지난 로그인이 끝나 있었다', () => {
  let toastInfo: MockInstance<typeof toast.info>;

  beforeEach(() => {
    vi.clearAllMocks();
    toastInfo = vi.spyOn(toast, 'info');
  });

  afterEach(() => {
    toastInfo.mockRestore();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('공개 화면이면 닫을 때까지 남는 만료 안내를 띄우고, 그 버튼은 기본 로그인 창을 연다', () => {
    window.history.replaceState(null, '', '/post?sort=latest');

    AuthUtil.notifySessionExpiredOnStart();

    expect(toastInfo).toHaveBeenCalledTimes(1);
    const [message, options] = toastInfo.mock.calls[0]!;
    expect(message).toBe(TEXTS.messages.info.sessionExpired);
    expect(options).toMatchObject({ id: 'session-expired', duration: Infinity });

    const action = options?.action as { label: string; onClick: () => void };
    expect(action.label).toBe(TEXTS.buttons.login);
    action.onClick();

    // 만료 문구 창(loginDialogReason)이 아니라 내비게이션 바 [로그인]과 같은 창이다
    expect(NavigationService.navigate).toHaveBeenCalledWith('/post?sort=latest', {
      state: { loginDialogOpen: true },
      preventScrollReset: true,
    });
  });

  it('로그인 창이 이미 열려 있으면 버튼을 눌러도 엔트리를 더 쌓지 않는다', () => {
    window.history.replaceState(null, '', '/post');
    vi.spyOn(RouterEvents, 'getLocation').mockReturnValue({
      state: { loginDialogOpen: true },
    } as Location);

    AuthUtil.notifySessionExpiredOnStart();
    const action = toastInfo.mock.calls[0]![1]?.action as { label: string; onClick: () => void };
    action.onClick();

    expect(NavigationService.navigate).not.toHaveBeenCalled();
  });

  it('보호 화면이면 띄우지 않는다 - ProtectedRoute가 로그인 창을 연다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.POST.SUBMIT);

    AuthUtil.notifySessionExpiredOnStart();

    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('로그인·가입 화면이면 띄우지 않는다 - 폼이 바로 앞에 있다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.AUTH.LOGIN);
    AuthUtil.notifySessionExpiredOnStart();

    window.history.replaceState(null, '', ROUTES_PATHS.AUTH.SIGNUP);
    AuthUtil.notifySessionExpiredOnStart();

    expect(toastInfo).not.toHaveBeenCalled();
  });
});

describe('AuthUtil.reflectSignOutFromElsewhere — 다른 탭의 로그아웃을 이 탭에 반영', () => {
  const DIRTY_KEY = 'post-create';

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    useAuthStore.getState().setAuth('token-a');
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
    clearUnsavedChanges(DIRTY_KEY);
    window.history.replaceState(null, '', '/');
  });

  it('쓰는 중이 아니면 지금처럼 보호 경로에서 /post로 옮긴다 - 로그인 창은 열지 않는다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);

    AuthUtil.reflectSignOutFromElsewhere();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().signedOutInPlace).toBeNull();
    expect(NavigationService.navigate).toHaveBeenCalledTimes(1);
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
  });

  it('보호 경로에서 쓰는 중이면 옮기지 않고 캐시를 둔 채 그 자리에 로그인 창을 연다', () => {
    window.history.replaceState(null, '', ROUTES_PATHS.POST.SUBMIT);
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);
    queryClient.setQueryData(['probe'], 'kept');

    AuthUtil.reflectSignOutFromElsewhere();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().signedOutInPlace).toEqual({
      reason: 'signedOutElsewhere',
      pathname: ROUTES_PATHS.POST.SUBMIT,
    });
    expect(queryClient.getQueryData(['probe'])).toBe('kept');
    expect(NavigationService.navigate).toHaveBeenCalledTimes(1);
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.SUBMIT, {
      state: { loginDialogOpen: true, loginDialogReason: 'signedOutElsewhere' },
      replace: false,
      preventScrollReset: true,
    });
  });

  it('공개 경로에서 쓰는 중이면 비로그인으로 다시 불러오고 그 자리에 로그인 창을 연다', async () => {
    window.history.replaceState(null, '', '/post/post-1');
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);
    const queryFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useQuery({ queryKey: ['probe'], queryFn }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    AuthUtil.reflectSignOutFromElsewhere();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(NavigationService.navigate).toHaveBeenCalledWith('/post/post-1', {
      state: { loginDialogOpen: true, loginDialogReason: 'signedOutElsewhere' },
      replace: false,
      preventScrollReset: true,
    });
  });
});

describe('useAuthStore.leaveSignedOutInPlace — 그 화면을 떠나면 제자리 표시를 내린다', () => {
  it('같은 화면 안의 이동(로그인 창 열고 닫기)은 그대로 두고, 다른 화면으로 가면 내린다', () => {
    useAuthStore.getState().expireSession(ROUTES_PATHS.POST.SUBMIT);

    useAuthStore.getState().leaveSignedOutInPlace(ROUTES_PATHS.POST.SUBMIT);
    expect(useAuthStore.getState().signedOutInPlace).not.toBeNull();

    useAuthStore.getState().leaveSignedOutInPlace(ROUTES_PATHS.POST.ROOT);
    expect(useAuthStore.getState().signedOutInPlace).toBeNull();
  });

  it('다시 로그인하면(setAuth) 내린다', () => {
    useAuthStore.getState().clearLocalAuthInPlace(ROUTES_PATHS.POST.SUBMIT);

    useAuthStore.getState().setAuth('token-b');

    expect(useAuthStore.getState().signedOutInPlace).toBeNull();
  });
});

describe('AuthUtil.leaveSignedOutInPlace — 로그인 없이 그 화면을 떠나면 남겨 둔 것을 정리한다', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    AuthUtil.resetLogoutGuard();
  });

  it('보호 경로에 둔 화면을 떠나면 화면을 남기려고 두었던 캐시(이전 회원의 계정 등)를 지운다', () => {
    useAuthStore.getState().expireSession(ROUTES_PATHS.POST.SUBMIT);
    queryClient.setQueryData(['probe'], 'previous-member');

    AuthUtil.leaveSignedOutInPlace(ROUTES_PATHS.POST.ROOT);

    expect(useAuthStore.getState().signedOutInPlace).toBeNull();
    expect(queryClient.getQueryData(['probe'])).toBeUndefined();
  });

  it('같은 화면 안의 이동(로그인 창 열고 닫기)은 그대로 두고 캐시도 지우지 않는다', () => {
    useAuthStore.getState().expireSession(ROUTES_PATHS.POST.SUBMIT);
    queryClient.setQueryData(['probe'], 'kept');

    AuthUtil.leaveSignedOutInPlace(ROUTES_PATHS.POST.SUBMIT);

    expect(useAuthStore.getState().signedOutInPlace).not.toBeNull();
    expect(queryClient.getQueryData(['probe'])).toBe('kept');
  });

  it('공개 경로는 로그인이 풀릴 때 이미 다시 불러왔으니 표시만 내린다', () => {
    useAuthStore.getState().clearLocalAuthInPlace('/post/post-1');
    queryClient.setQueryData(['probe'], 'guest-data');

    AuthUtil.leaveSignedOutInPlace(ROUTES_PATHS.POST.ROOT);

    expect(useAuthStore.getState().signedOutInPlace).toBeNull();
    expect(queryClient.getQueryData(['probe'])).toBe('guest-data');
  });
});

describe('AuthUtil.applySessionMismatch — 다른 계정으로 바뀐 공유 쿠키', () => {
  const DIRTY_KEY = 'comment-create:post-1';

  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
    useAuthStore.getState().setAuth('token-a');
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
    clearUnsavedChanges(DIRTY_KEY);
    window.history.replaceState(null, '', '/');
  });

  it('공개 화면에서 쓰는 중이었으면 이전 계정의 글을 버리고 피드로 간다', () => {
    window.history.replaceState(null, '', '/post/post-1');
    useUnsavedChangesStore.getState().markDirty(DIRTY_KEY);

    AuthUtil.applySessionMismatch();

    expect(useUnsavedChangesStore.getState().dirtyKeys.size).toBe(0);
    expect(NavigationService.navigate).toHaveBeenCalledTimes(1);
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
  });

  it('공개 화면에서 쓰는 중이 아니면 그 자리에 둔다', () => {
    window.history.replaceState(null, '', '/post/post-1');

    AuthUtil.applySessionMismatch();

    expect(NavigationService.navigate).not.toHaveBeenCalled();
  });
});
