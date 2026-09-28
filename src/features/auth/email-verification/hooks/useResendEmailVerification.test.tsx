import { type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
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
});
