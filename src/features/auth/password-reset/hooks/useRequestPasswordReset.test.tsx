import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
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
