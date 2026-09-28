import { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useConfirmEmailVerification } from '@/features/auth/email-verification/hooks/useConfirmEmailVerification';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function wrapperWithSearch(search: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[`/auth/verify-email${search}`]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useConfirmEmailVerification', () => {
  it('URL에 token이 없으면 요청 없이 곧바로 error 상태다', () => {
    const { result } = renderHook(() => useConfirmEmailVerification(), {
      wrapper: wrapperWithSearch(''),
    });

    expect(result.current.status).toBe('error');
  });

  it('token이 있으면 pending에서 시작해 성공하면 success로 바뀐다', async () => {
    const { result } = renderHook(() => useConfirmEmailVerification(), {
      wrapper: wrapperWithSearch('?token=valid-token'),
    });

    expect(result.current.status).toBe('pending');

    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('BE가 실패를 반환하면 error로 바뀐다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationConfirm), () => {
        return HttpResponse.json(
          { status: 401, code: 'INVALID_ACTION_TOKEN', message: 'invalid', timestamp: '' },
          { status: 401 }
        );
      })
    );

    const { result } = renderHook(() => useConfirmEmailVerification(), {
      wrapper: wrapperWithSearch('?token=expired-token'),
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
