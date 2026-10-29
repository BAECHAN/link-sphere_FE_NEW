import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { createTestQueryClient } from '@/test/utils';
import { useAuth } from '@/entities/auth/hooks/useAuth';
import { useAuthStore } from '@/shared/store/auth.store';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { requestAndRegisterFcmToken, reregisterFcmTokenIfGranted } from '@/shared/lib/firebase/fcm';

vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  reregisterFcmTokenIfGranted: vi.fn(),
  unregisterFcmToken: vi.fn(),
}));

// login/logout mutation은 auth.queries.test.ts가 이미 검증한다 - 여기서는
// restoreAuth 4갈래 판단과 discriminated union 반환 계약만 다룬다.
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useAuth', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  describe('반환 계약', () => {
    it('비인증 상태면 isAuthenticated=false이고 accessToken은 null이다', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.accessToken).toBeNull();
    });

    it('인증 상태면 isAuthenticated=true이고 accessToken이 문자열이다', () => {
      useAuthStore.getState().setAuth('test-access-token');
      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.accessToken).toBe('test-access-token');
    });
  });

  describe('restoreAuth', () => {
    it('이미 토큰이 있고 인증 상태면 네트워크 요청 없이 true를 반환한다', async () => {
      useAuthStore.getState().setAuth('existing-token');
      let requested = false;
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () => {
          requested = true;
          return HttpResponse.json({}, { status: 200 });
        })
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      const restored = await act(async () => result.current.restoreAuth());

      expect(restored).toBe(true);
      expect(requested).toBe(false);
    });

    it('refresh가 accessToken을 주면 인증 상태로 전환하고 true를 반환한다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: { accessToken: 'refreshed-token' }, timestamp: '' },
            { status: 200 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      const restored = await act(async () => result.current.restoreAuth());

      expect(restored).toBe(true);
      await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
      expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
    });

    it('세션을 복원하면 알림 권한을 묻지 않는 FCM 재등록만 부른다', async () => {
      vi.mocked(requestAndRegisterFcmToken).mockClear();
      vi.mocked(reregisterFcmTokenIfGranted).mockClear();
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: { accessToken: 'refreshed-token' }, timestamp: '' },
            { status: 200 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      await act(async () => result.current.restoreAuth());

      expect(reregisterFcmTokenIfGranted).toHaveBeenCalledTimes(1);
      expect(requestAndRegisterFcmToken).not.toHaveBeenCalled();
    });

    it('refresh 응답에 accessToken이 없으면 인증을 지우고 false를 반환한다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: {}, timestamp: '' },
            { status: 200 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      const restored = await act(async () => result.current.restoreAuth());

      expect(restored).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('refresh가 실패(401)하면 인증을 지우고 false를 반환한다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 401, code: 'UNAUTHORIZED', message: '', timestamp: '' },
            { status: 401 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      const restored = await act(async () => result.current.restoreAuth());

      expect(restored).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // 앱 시작 때 만료 안내를 띄울지 가르는 갈래 - 실패면 어느 쪽이든 로그아웃한다(useAppInitialization)
  describe('restoreAuthWithResult', () => {
    it('refresh가 accessToken을 주면 restored다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: { accessToken: 'refreshed-token' }, timestamp: '' },
            { status: 200 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      const restored = await act(async () => result.current.restoreAuthWithResult());

      expect(restored).toBe('restored');
      expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
    });

    it('BE가 refresh를 401로 거절하면(쿠키 만료·폐기) 인증을 지우고 expired다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 401, code: 'INVALID_REFRESH_TOKEN', message: '', timestamp: '' },
            { status: 401 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });
      const restored = await act(async () => result.current.restoreAuthWithResult());

      expect(restored).toBe('expired');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('5xx·네트워크 실패는 만료가 아니라 failed다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 500, code: 'INTERNAL_SERVER_ERROR', message: '', timestamp: '' },
            { status: 500 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

      expect(await act(async () => result.current.restoreAuthWithResult())).toBe('failed');

      server.use(http.post(url(API_ENDPOINTS.auth.refresh), () => HttpResponse.error()));

      expect(await act(async () => result.current.restoreAuthWithResult())).toBe('failed');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('refresh 응답에 accessToken이 없으면 failed다', async () => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.refresh), () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: {}, timestamp: '' },
            { status: 200 }
          )
        )
      );

      const { result } = renderHook(() => useAuth(), { wrapper: createWrapper(queryClient) });

      expect(await act(async () => result.current.restoreAuthWithResult())).toBe('failed');
    });
  });
});
