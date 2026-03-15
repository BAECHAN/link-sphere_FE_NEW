import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import {
  useUpdateAccountMutation,
  useUploadAvatarMutation,
} from '@/entities/user/api/auth.queries';

vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  unregisterFcmToken: vi.fn(),
}));

const mockInvalidateAccount = vi.fn();
const mockHandleAccountUpdateSuccess = vi.fn();

vi.mock('@/entities/user/api/auth.keys', () => ({
  authInvalidateQueries: { account: () => mockInvalidateAccount(), all: vi.fn() },
  authKeys: { root: () => ['auth'], account: () => ['auth', 'account'] },
  handleAccountUpdateSuccess: () => mockHandleAccountUpdateSuccess(),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useUpdateAccountMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockInvalidateAccount.mockClear();
  });

  it('성공 시 account 쿼리를 invalidate한다', async () => {
    const { result } = renderHook(() => useUpdateAccountMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ nickname: 'newNick' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockHandleAccountUpdateSuccess).toHaveBeenCalled();
  });

  it('409 에러 시 isError가 true가 된다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), () => {
        return HttpResponse.json(
          { code: 'DUPLICATE_MEMBER', message: 'Nickname already exists' },
          { status: 409 }
        );
      })
    );

    const { result } = renderHook(() => useUpdateAccountMutation(), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ nickname: 'taken' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUploadAvatarMutation', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('파일 업로드 성공 시 imageUrl을 반환한다', async () => {
    const { result } = renderHook(() => useUploadAvatarMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const file = new File(['content'], 'avatar.png', { type: 'image/png' });
    result.current.mutate(file);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.imageUrl).toBe(
      'https://supabase.co/storage/v1/object/public/avatars/test.png'
    );
  });
});
