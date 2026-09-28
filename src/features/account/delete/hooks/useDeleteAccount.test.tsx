import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useDeleteAccount } from '@/features/account/delete/hooks/useDeleteAccount';

vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// AuthUtil.clearAll이 쓰는 두 모듈 - auth.util.test.ts와 같은 이유로 이 파일 안에서만 모킹한다.
vi.mock('@/shared/lib/react-query/config/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { queryClient: new QueryClient() };
});
vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: { navigate: vi.fn(), setNavigate: vi.fn() },
}));

// openConfirm이 실제 다이얼로그를 띄우는 대신 onConfirm을 즉시 실행하게 한다 - 이 훅의
// 관심사는 "확인 다이얼로그를 연다"가 아니라 "확인 후 올바른 요청을 보낸다"이다.
vi.mock('@/shared/ui/elements/modal/alert/alert.store', () => ({
  useAlert: () => ({
    openConfirm: (options: { onConfirm?: () => void }) => options.onConfirm?.(),
  }),
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useDeleteAccount', () => {
  it('제출하면 확인 다이얼로그를 거쳐 입력한 비밀번호로 탈퇴를 요청한다', async () => {
    let requestBody: unknown;
    server.use(
      http.delete(url(API_ENDPOINTS.auth.deleteAccount), async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { status: 200, message: 'ok', data: null, timestamp: new Date().toISOString() },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useDeleteAccount(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('password', 'myPassword1!', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() => expect(requestBody).toEqual({ password: 'myPassword1!' }));
  });
});
