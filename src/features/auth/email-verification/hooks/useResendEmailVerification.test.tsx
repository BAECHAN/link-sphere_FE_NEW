import { type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS, IDEMPOTENCY_KEY_HEADER } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { useResendEmailVerification } from '@/features/auth/email-verification/hooks/useResendEmailVerification';

vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useResendEmailVerification', () => {
  it('클릭하면 주어진 이메일로 재발송을 요청한다', async () => {
    let requestBody: unknown;
    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationRequest), async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { status: 200, message: 'ok', data: null, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useResendEmailVerification('user@example.com'), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.handleResend();
    });

    await waitFor(() => expect(requestBody).toEqual({ email: 'user@example.com' }));
  });

  it('응답이 끊겨 다시 보내도, 그 뒤 다시 눌러도 같은 키이고, 성공한 뒤 다시 누르면 새 키라 메일이 새로 간다', async () => {
    const received: (string | null)[] = [];
    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationRequest), ({ request }) => {
        received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));

        // 첫 누름은 다시 보낸 요청까지 끊긴다
        if (received.length <= 2) {
          return HttpResponse.error();
        }

        return HttpResponse.json({ status: 200, message: 'ok', data: null, timestamp: '' });
      })
    );

    const { result } = renderHook(() => useResendEmailVerification('user@example.com'), {
      wrapper: Wrapper,
    });

    for (const expectedRequests of [2, 3, 4]) {
      act(() => {
        result.current.handleResend();
      });

      await waitFor(() => expect(received).toHaveLength(expectedRequests));
      await waitFor(() => expect(result.current.isPending).toBe(false));
    }

    expect(received[0]).toBeTruthy();
    expect(received[1]).toBe(received[0]);
    expect(received[2]).toBe(received[0]);
    expect(received[3]).not.toBe(received[0]);
  });
});
