import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useConfirmPasswordReset } from '@/features/auth/password-reset/hooks/useConfirmPasswordReset';

vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function wrapperWithSearch(search: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter initialEntries={[`/auth/reset-password${search}`]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useConfirmPasswordReset', () => {
  it('URL에 token이 없으면 hasToken이 false다', () => {
    const { result } = renderHook(() => useConfirmPasswordReset(), {
      wrapper: wrapperWithSearch(''),
    });

    expect(result.current.hasToken).toBe(false);
  });

  it('URL의 token을 폼 기본값으로 그대로 읽어들이고 hasToken이 true다', () => {
    const { result } = renderHook(() => useConfirmPasswordReset(), {
      wrapper: wrapperWithSearch('?token=raw-token-value'),
    });

    expect(result.current.hasToken).toBe(true);
    expect(result.current.form.getValues('token')).toBe('raw-token-value');
  });

  it('제출하면 URL의 token과 입력한 새 비밀번호로 재설정을 요청한다', async () => {
    let requestBody: unknown;
    server.use(
      http.post(url(API_ENDPOINTS.auth.passwordResetConfirm), async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { status: 200, message: 'ok', data: null, timestamp: new Date().toISOString() },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useConfirmPasswordReset(), {
      wrapper: wrapperWithSearch('?token=raw-token-value'),
    });

    act(() => {
      result.current.form.setValue('newPassword', 'newPassword1!', { shouldDirty: true });
      result.current.form.setValue('confirmPassword', 'newPassword1!', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit(result.current.form.getValues());
    });

    await waitFor(() =>
      expect(requestBody).toEqual({ token: 'raw-token-value', newPassword: 'newPassword1!' })
    );
  });

  // 만료·사용된 링크(#491 4번) - 폼이 그대로면 다시 눌러도 같은 거절만 받는다
  it.each([
    { status: 400, code: SERVER_ERROR_CODE.INVALID_ACTION_TOKEN, rejected: true },
    { status: 500, code: 'INTERNAL_SERVER_ERROR', rejected: false },
  ])(
    '$code로 실패하면 처리되지 않은 rejection 없이 끝나고, 토큰 거절 여부는 $rejected다',
    async ({ status, code, rejected }) => {
      server.use(
        http.post(url(API_ENDPOINTS.auth.passwordResetConfirm), () =>
          HttpResponse.json({ status, code, message: 'fail', timestamp: '' }, { status })
        )
      );

      const { result } = renderHook(() => useConfirmPasswordReset(), {
        wrapper: wrapperWithSearch('?token=raw-token-value'),
      });

      act(() => {
        result.current.form.setValue('newPassword', 'newPassword1!', { shouldDirty: true });
        result.current.form.setValue('confirmPassword', 'newPassword1!', { shouldDirty: true });
      });

      await act(async () => {
        await expect(
          result.current.onSubmit(result.current.form.getValues())
        ).resolves.toBeUndefined();
      });

      expect(result.current.isTokenRejected).toBe(rejected);
      expect(result.current.hasToken).toBe(true);
    }
  );
});
