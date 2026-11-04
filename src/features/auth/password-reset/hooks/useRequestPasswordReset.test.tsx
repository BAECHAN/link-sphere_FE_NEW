import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS, IDEMPOTENCY_KEY_HEADER } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useRequestPasswordReset } from '@/features/auth/password-reset/hooks/useRequestPasswordReset';

vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('useRequestPasswordReset', () => {
  it('제출에 성공하면(계정 존재 여부와 무관하게 서버가 항상 200) isSubmitted가 true가 된다', async () => {
    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('email', 'nonexistent@example.com', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });

    await waitFor(() => expect(result.current.isSubmitted).toBe(true));
  });

  it('첫 제출이 성공한 뒤 [다시 보내기]는 새 키라 메일이 새로 간다', async () => {
    const received: (string | null)[] = [];
    server.use(
      http.post(url(API_ENDPOINTS.auth.passwordResetRequest), ({ request }) => {
        received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));

        return HttpResponse.json({ status: 200, message: 'ok', data: null, timestamp: '' });
      })
    );
    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('email', 'user@example.com', { shouldDirty: true });
    });
    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });
    act(() => {
      result.current.handleResend();
    });
    await waitFor(() => expect(received).toHaveLength(2));

    expect(received[0]).toBeTruthy();
    expect(received[1]).not.toBe(received[0]);
  });

  it('요청 자체가 실패하면(네트워크·서버 오류) isSubmitted는 false로 남는다', async () => {
    server.use(http.post(url(API_ENDPOINTS.auth.passwordResetRequest), () => HttpResponse.error()));

    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('email', 'user@example.com', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues()).catch(() => {});
    });

    expect(result.current.isSubmitted).toBe(false);
  });
});
