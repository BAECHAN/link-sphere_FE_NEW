import { type ReactNode, StrictMode } from 'react';
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

  it('StrictMode(개발 모드)에서도 요청은 한 번만 나가고 결과가 화면 상태에 반영된다', async () => {
    let requestCount = 0;
    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationConfirm), () => {
        requestCount += 1;
        return HttpResponse.json({ status: 200, message: 'ok', data: null, timestamp: '' });
      })
    );
    const Wrapper = wrapperWithSearch('?token=valid-token');

    const { result } = renderHook(() => useConfirmEmailVerification(), {
      wrapper: ({ children }) => (
        <StrictMode>
          <Wrapper>{children}</Wrapper>
        </StrictMode>
      ),
    });

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(requestCount).toBe(1);
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

  it.each([
    ['연결이 끊기면', () => HttpResponse.error()],
    ['504면', () => HttpResponse.json({}, { status: 504 })],
  ])('%s 실패로 단정하지 않고 unknown으로 바뀐다', async (_, response) => {
    let requestCount = 0;

    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationConfirm), () => {
        requestCount += 1;

        return response();
      })
    );

    const { result } = renderHook(() => useConfirmEmailVerification(), {
      wrapper: wrapperWithSearch('?token=valid-token'),
    });

    await waitFor(() => expect(result.current.status).toBe('unknown'));
    expect(requestCount).toBe(1);
  });
});
