import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { createTestQueryClient } from '@/test/utils';
import { useAppInitialization } from '@/entities/user/hooks/useAppInitialization';
import { useAuthStore } from '@/shared/store/auth.store';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

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

describe('useAppInitialization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    window.localStorage.clear();
  });

  afterEach(() => {
    useAuthStore.getState().setAuthResolved(false);
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('세션 흔적이 없으면 refresh를 호출하지 않고도 isAuthResolved가 true가 된다', async () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.auth.refresh), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );

    renderHook(() => useAppInitialization(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(useAuthStore.getState().isAuthResolved).toBe(true));
    expect(requested).toBe(false);
  });

  it('세션 흔적이 있으면 refresh를 호출한다', async () => {
    LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.HAS_SESSION, true);
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.auth.refresh), () => {
        requested = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { accessToken: 'restored-token' }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    renderHook(() => useAppInitialization(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(requested).toBe(true));
    await waitFor(() => expect(useAuthStore.getState().isAuthResolved).toBe(true));
  });

  it('복원이 실패해도 isAuthResolved는 true가 된다 (영구 스피너 방지)', async () => {
    LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.HAS_SESSION, true);
    server.use(
      http.post(url(API_ENDPOINTS.auth.refresh), () =>
        HttpResponse.json(
          { status: 401, code: 'UNAUTHORIZED', message: '', timestamp: '' },
          { status: 401 }
        )
      )
    );

    renderHook(() => useAppInitialization(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(useAuthStore.getState().isAuthResolved).toBe(true));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('재렌더돼도 refresh는 1회만 나간다 (hasInitialized ref)', async () => {
    LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.HAS_SESSION, true);
    let requestCount = 0;
    server.use(
      http.post(url(API_ENDPOINTS.auth.refresh), () => {
        requestCount += 1;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { accessToken: 'restored-token' }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const { rerender } = renderHook(() => useAppInitialization(), {
      wrapper: createWrapper(queryClient),
    });
    rerender();
    rerender();

    await waitFor(() => expect(useAuthStore.getState().isAuthResolved).toBe(true));
    expect(requestCount).toBe(1);
  });
});
