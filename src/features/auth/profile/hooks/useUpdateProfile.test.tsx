import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useUpdateProfile } from '@/features/auth/profile/hooks/useUpdateProfile';
import { mockAccount } from '@/mocks/fixtures/auth.fixtures';

vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  unregisterFcmToken: vi.fn(),
}));

vi.mock('@/entities/user/api/auth.keys', () => ({
  authInvalidateQueries: { account: vi.fn(), all: vi.fn() },
  authKeys: { root: () => ['auth'], account: () => ['auth', 'account'] },
  handleAccountUpdateSuccess: vi.fn(),
}));

// URL.createObjectURL stub — URL 클래스 자체는 유지하고 메서드만 추가
URL.createObjectURL = vi.fn(() => 'blob:mock-url');
URL.revokeObjectURL = vi.fn();

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

describe('useUpdateProfile', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    // QueryClient 캐시에 account 데이터를 직접 주입 → GET 요청 없이 즉시 account 반환
    queryClient.setQueryData(['auth', 'account'], mockAccount);
  });

  it('초기값이 account 데이터로 세팅된다', async () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    // useEffect([account, reset])가 실행된 후 form 값이 세팅될 때까지 대기
    await waitFor(() => expect(result.current.form.getValues('nickname')).toBe('testuser'));
    expect(result.current.account?.nickname).toBe('testuser');
  });

  it('이미지 파일 선택 시 avatarPreview가 blob URL로 업데이트된다', () => {
    const { result } = renderHook(() => useUpdateProfile(), {
      wrapper: createWrapper(queryClient),
    });

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });

    act(() => {
      result.current.handleAvatarChange(file);
    });

    expect(result.current.avatarPreview).toBe('blob:mock-url');
  });

  it('이미지 없이 닉네임만 변경하면 PATCH /auth/account만 호출된다', async () => {
    const patchCalled = vi.fn();

    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async ({ request }) => {
        patchCalled(await request.json());
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockAccount, nickname: 'newNick' },
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateProfile(onSuccess), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    act(() => {
      result.current.form.setValue('nickname', 'newNick');
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() =>
      expect(patchCalled).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'newNick' }))
    );
  });

  it('이미지와 닉네임 모두 변경 시 uploadAvatar 후 updateAccount가 호출된다', async () => {
    const uploadCalled = vi.fn();
    const patchCalled = vi.fn();

    server.use(
      http.post(url(API_ENDPOINTS.auth.uploadAvatar), () => {
        uploadCalled();
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { imageUrl: 'https://example.com/new-avatar.png' },
            timestamp: '',
          },
          { status: 200 }
        );
      }),
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async ({ request }) => {
        patchCalled(await request.json());
        return HttpResponse.json(
          { status: 200, message: 'ok', data: mockAccount, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useUpdateProfile(onSuccess), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.account?.nickname).toBe('testuser'));

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    act(() => {
      result.current.handleAvatarChange(file);
      result.current.form.setValue('nickname', 'newNick');
    });

    await act(async () => {
      await result.current.onSubmit({ preventDefault: vi.fn() } as never);
    });

    await waitFor(() => {
      expect(uploadCalled).toHaveBeenCalled();
      expect(patchCalled).toHaveBeenCalledWith(
        expect.objectContaining({ image: 'https://example.com/new-avatar.png' })
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
