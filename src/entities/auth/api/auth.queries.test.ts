import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import {
  useChangePasswordMutation,
  useCreateAccountMutation,
  useLoginMutation,
  useLogoutMutation,
  useRequestEmailVerificationMutation,
  useRequestPasswordResetMutation,
} from '@/entities/auth/api/auth.queries';
import { TEXTS } from '@/shared/config/texts';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { useAuthStore } from '@/shared/store/auth.store';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { ApiError } from '@/shared/types/common.type';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { postKeys } from '@/entities/post/api/post.keys';
import { requestAndRegisterFcmToken, reregisterFcmTokenIfGranted } from '@/shared/lib/firebase/fcm';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock('@/shared/lib/toast/toast', () => ({
  toast: {
    error: (...args: unknown[]) => {
      mockToastError(...args);
    },
    success: (...args: unknown[]) => {
      mockToastSuccess(...args);
    },
    // 로그인 성공이 만료 안내 토스트를 닫는다(AuthUtil.dismissSessionExpiredToast)
    dismiss: vi.fn(),
  },
}));

// 로그아웃은 unregisterFcmToken()의 반환값에 .catch를 이어 붙이므로 Promise를 돌려줘야 한다.
vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  reregisterFcmTokenIfGranted: vi.fn(),
  unregisterFcmToken: vi.fn().mockResolvedValue(undefined),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: createTestQueryClient() },
    createElement(MemoryRouter, null, children)
  );
}

describe('useLoginMutation', () => {
  // setQueryData/fetchQuery로 캐시 상태를 직접 심고 나중에 getQueryState로 검증하므로
  // gcTime: Infinity가 필요하다 - 기본값 0이면 옵저버 없는 쿼리가 다음 틱에 GC돼
  // 수정 전에도 통과하는 가짜 테스트가 된다(createTestQueryClient 참고).
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient({ gcTime: Infinity });
  });

  function LoginWrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  // 로그아웃 시 clearQueries()의 resetQueries()가 토큰 없이 배경 재요청해 만드는 상태를
  // 그대로 재현한다. MSW로 실제 401을 태우면 ApiClient가 AuthUtil.clearAll()로 싱글턴
  // queryClient·NavigationService까지 건드려 테스트 격리가 깨지므로(client.ts의
  // NOT_LOGGED_IN 분기), fetchQuery로 상태만 직접 심는다.
  async function seedErrorQuery(queryKey: readonly unknown[]) {
    await queryClient
      .fetchQuery({
        queryKey,
        queryFn: () =>
          Promise.reject(
            new ApiError({
              status: 401,
              code: 'NOT_LOGGED_IN',
              message: 'Authentication required',
              timestamp: new Date().toISOString(),
            })
          ),
      })
      .catch(() => {});
  }

  it('로그아웃이 남긴 에러 상태 캐시(데이터 없음)를 로그인 성공 시 초기화한다', async () => {
    await seedErrorQuery(commentKeys.myRoot);

    // 사전 조건: 비활성(옵저버 없음) + error 상태로 고정해둔다.
    expect(queryClient.getQueryState(commentKeys.myRoot)?.status).toBe('error');
    expect(
      queryClient.getQueryCache().find({ queryKey: commentKeys.myRoot })?.getObserversCount()
    ).toBe(0);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const state = queryClient.getQueryState(commentKeys.myRoot);
    expect(state?.status).toBe('pending');
    expect(state?.error).toBeNull();
    expect(state?.data).toBeUndefined();
  });

  it('로그인하면 세션 플래그를 쓴 뒤 인증 세대를 in:으로 바꾼다 - 다른 탭이 알아채는 신호', async () => {
    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(LocalStorageUtil.getItem(STORAGE_KEYS.AUTH.HAS_SESSION)).toBe(true);
    expect(LocalStorageUtil.getItem<string>(STORAGE_KEYS.AUTH.EPOCH)).toMatch(/^in:/);
    // 이 탭이 쓴 값이라 이 탭 기준으로는 바뀐 게 아니다
    expect(AuthEpochUtil.isStale()).toBe(false);
  });

  it('정상 데이터가 있는 쿼리는 로그인 후에도 캐시를 그대로 둔다', async () => {
    const seeded = [{ id: 'post-1' }];
    queryClient.setQueryData(postKeys.list(), seeded);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(postKeys.list())).toEqual(seeded);
    expect(queryClient.getQueryState(postKeys.list())?.status).toBe('success');
  });

  it('데이터를 들고 있는데 재요청만 실패한 쿼리는 건드리지 않는다 (제자리 로그인 깜빡임 방지)', async () => {
    const seeded = [{ id: 'post-1' }];
    queryClient.setQueryData(postKeys.list(), seeded);
    // 이미 데이터가 있는 쿼리의 배경 재요청만 실패한 상태를 재현한다 - data는 유지된 채
    // status만 error가 된다.
    await queryClient
      .fetchQuery({
        queryKey: postKeys.list(),
        queryFn: () => Promise.reject(new Error('background refetch failed')),
      })
      .catch(() => {});

    expect(queryClient.getQueryState(postKeys.list())?.status).toBe('error');
    expect(queryClient.getQueryData(postKeys.list())).toEqual(seeded);

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // predicate가 data === undefined도 요구하므로, 데이터를 들고 있는 이 쿼리는 리셋되지 않는다.
    expect(queryClient.getQueryData(postKeys.list())).toEqual(seeded);
  });

  it('401이 아닌 에러(네트워크 오류 등)도 무반응 대신 일반 실패 메시지 토스트를 띄운다', async () => {
    // MSW의 네트워크 레벨 에러 - ApiError가 아닌 에러 경로를 재현한다.
    mockToastError.mockClear();
    server.use(http.post(url(API_ENDPOINTS.auth.login), () => HttpResponse.error()));

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(TEXTS.messages.error.loginFailed);
  });

  it('로그인 응답의 deletionCancelled가 true면 탈퇴 신청 취소 토스트를 띄운다', async () => {
    mockToastSuccess.mockClear();
    server.use(
      http.post(url(API_ENDPOINTS.auth.login), () =>
        HttpResponse.json({
          status: 200,
          message: 'Login successful',
          data: { accessToken: 'mock-access-token', deletionCancelled: true },
          timestamp: new Date().toISOString(),
        })
      )
    );

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToastSuccess).toHaveBeenCalledWith(TEXTS.messages.success.accountDeletionCancelled);
  });

  it('일반 로그인(deletionCancelled 없음)은 복구 토스트를 띄우지 않는다', async () => {
    mockToastSuccess.mockClear();

    const { result } = renderHook(() => useLoginMutation(), { wrapper: LoginWrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com', password: 'password1!' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe('useLogoutMutation', () => {
  it('로그아웃하면 세션 플래그를 지운 뒤 인증 세대를 out:으로 바꾼다 - 키를 지우지 않는다', () => {
    useAuthStore.getState().setAuth('token-a');
    AuthEpochUtil.markLogin();

    const { result } = renderHook(() => useLogoutMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(LocalStorageUtil.getItem(STORAGE_KEYS.AUTH.HAS_SESSION)).toBeNull();
    expect(LocalStorageUtil.getItem<string>(STORAGE_KEYS.AUTH.EPOCH)).toMatch(/^out:/);
    expect(AuthEpochUtil.isStale()).toBe(false);
  });

  it('로그아웃하면 응답을 못 받은 등록의 키를 지운다', () => {
    sessionStorage.setItem(STORAGE_KEYS.IDEMPOTENCY.PENDING, '[]');

    const { result } = renderHook(() => useLogoutMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate();
    });

    expect(sessionStorage.getItem(STORAGE_KEYS.IDEMPOTENCY.PENDING)).toBeNull();
  });
});

describe('useChangePasswordMutation', () => {
  it('비밀번호를 바꾸면 새 토큰으로 갱신하고, 알림 권한을 묻지 않는 FCM 재등록만 부른다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.auth.changePassword), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { accessToken: 'new-token' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      )
    );
    vi.mocked(requestAndRegisterFcmToken).mockClear();
    vi.mocked(reregisterFcmTokenIfGranted).mockClear();

    const { result } = renderHook(() => useChangePasswordMutation(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        currentPassword: 'oldPassword1!',
        newPassword: 'newPassword1!',
        confirmPassword: 'newPassword1!',
      });
    });

    expect(useAuthStore.getState().accessToken).toBe('new-token');
    expect(reregisterFcmTokenIfGranted).toHaveBeenCalledTimes(1);
    expect(requestAndRegisterFcmToken).not.toHaveBeenCalled();
  });

  // 데모 계정처럼 비밀번호 변경 권한이 없는 역할(BE MemberRole) - manualErrorHandling이라 전역 문구가 뜨지 않는다
  it('권한이 없는 역할(ACCESS_DENIED)이면 접근 권한이 없다고 안내한다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.auth.changePassword), () =>
        HttpResponse.json(
          { status: 403, code: 'ACCESS_DENIED', message: 'Access is denied' },
          { status: 403 }
        )
      )
    );
    mockToastError.mockClear();

    const { result } = renderHook(() => useChangePasswordMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        currentPassword: 'demoPassword1!',
        newPassword: 'newPassword1!',
        confirmPassword: 'newPassword1!',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(TEXTS.messages.error.accessDenied);
  });
});

describe('useCreateAccountMutation', () => {
  beforeEach(() => {
    mockToastError.mockClear();
  });

  it('실패 토스트를 띄우지 않는다 - 머문 경우와 떠난 경우를 나눠 useSignUp이 띄운다', async () => {
    // manualErrorHandling: true라 전역 핸들러도 띄우지 않는다. 원인 판정은 SignUpUtil.resolveSubmitError
    server.use(http.post(url(API_ENDPOINTS.auth.signup), () => HttpResponse.error()));

    const { result } = renderHook(() => useCreateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        nickname: 'newNick',
        email: 'new@example.com',
        password: 'password1!',
        confirmPassword: 'password1!',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

// 실패해도 화면이 그대로라("메일함을 확인해주세요"·인증 배너) 토스트가 유일한 안내다 - 닫을 때까지 남고 같은 id로
// 쌓이지 않아야 한다(docs/FE-ARCHITECTURE.md §14)
describe('메일 다시 보내기 실패 토스트', () => {
  beforeEach(() => {
    mockToastError.mockClear();
  });

  it('비밀번호 재설정 메일 요청이 실패하면 닫을 때까지 남는 토스트를 띄운다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.auth.passwordResetRequest), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
          { status: 500 }
        )
      )
    );

    const { result } = renderHook(() => useRequestPasswordResetMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ email: 'user@example.com' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(TEXTS.messages.error.passwordResetRequestFailed, {
      id: 'password-reset-request-error',
      duration: Infinity,
    });
  });

  it('인증 메일 다시 보내기가 실패하면 닫을 때까지 남는 토스트를 띄운다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationRequest), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
          { status: 500 }
        )
      )
    );

    const { result } = renderHook(() => useRequestEmailVerificationMutation(), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate({ email: 'user@example.com' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith(
      TEXTS.messages.error.emailVerificationRequestFailed,
      { id: 'email-verification-request-error', duration: Infinity }
    );
  });
});
