import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient } from '@/test/utils';
import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import { useChangePassword } from '@/features/auth/password-change/hooks/useChangePassword';

vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createTestQueryClient()}>{children}</QueryClientProvider>;
}

describe('useChangePassword', () => {
  it('제출하면 현재/새 비밀번호만 보내고(confirmPassword 제외) 성공 시 폼을 리셋한다', async () => {
    let requestBody: unknown;
    server.use(
      http.patch(url(API_ENDPOINTS.auth.changePassword), async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { accessToken: 'new-token' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        );
      })
    );

    const { result } = renderHook(() => useChangePassword(), { wrapper: Wrapper });

    act(() => {
      result.current.form.setValue('currentPassword', 'oldPassword1!', { shouldDirty: true });
      result.current.form.setValue('newPassword', 'newPassword1!', { shouldDirty: true });
      result.current.form.setValue('confirmPassword', 'newPassword1!', { shouldDirty: true });
    });

    await act(async () => {
      await result.current.onSubmit();
    });

    await waitFor(() =>
      expect(requestBody).toEqual({
        currentPassword: 'oldPassword1!',
        newPassword: 'newPassword1!',
      })
    );
    await waitFor(() => expect(result.current.form.getValues('currentPassword')).toBe(''));

    // 리셋은 isSubmitted·touched까지 되돌리므로 체크리스트·확인 칸 문구도 처음 상태로 돌아간다
    expect(Object.values(result.current.passwordFeedback.requirementListProps.states)).toEqual([
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
    expect(result.current.passwordFeedback.confirmMessageProps.status).toBe('none');
  });
});
