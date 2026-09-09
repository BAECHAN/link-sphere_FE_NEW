import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { createTestQueryClient } from '@/test/utils';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { useAuthStore } from '@/shared/store/auth.store';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
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

describe('useAccount', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    window.localStorage.clear();
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
    window.localStorage.clear();
  });

  it('비로그인이면 계정 조회를 하지 않고 isLoggedIn이 false다', () => {
    const { result } = renderHook(() => useAccount(), { wrapper: createWrapper(queryClient) });

    expect(result.current.account).toBeUndefined();
    expect(result.current.isLoggedIn).toBe(false);
  });

  it('로그인 상태면 계정을 반환하고 isLoggedIn이 true다', async () => {
    useAuthStore.getState().setAuth('token');
    const { result } = renderHook(() => useAccount(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.account).toEqual(mockAccount));
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('계정 이미지가 일반 URL이면 마지막 아바타로 저장한다', async () => {
    useAuthStore.getState().setAuth('token');
    server.use(
      http.get(url(API_ENDPOINTS.auth.account), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockAccount, image: 'https://example.com/avatar.png' },
            timestamp: '',
          },
          { status: 200 }
        )
      )
    );

    renderHook(() => useAccount(), { wrapper: createWrapper(queryClient) });

    await waitFor(() =>
      expect(LocalStorageUtil.getItem(STORAGE_KEYS.AUTH.LAST_AVATAR)).toBe(
        'https://example.com/avatar.png'
      )
    );
  });

  it('계정 이미지가 blob: URL이면 저장하지 않는다 (새로고침 후 깨지므로)', async () => {
    useAuthStore.getState().setAuth('token');
    server.use(
      http.get(url(API_ENDPOINTS.auth.account), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockAccount, image: 'blob:http://localhost/temp-preview' },
            timestamp: '',
          },
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useAccount(), { wrapper: createWrapper(queryClient) });

    await waitFor(() =>
      expect(result.current.account?.image).toBe('blob:http://localhost/temp-preview')
    );
    expect(LocalStorageUtil.getItem(STORAGE_KEYS.AUTH.LAST_AVATAR)).toBeNull();
  });
});
