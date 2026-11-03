import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';
import { VerifyEmailStatus } from '@/features/auth/email-verification/ui/VerifyEmailStatus';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

// 로그인 여부는 계정 프로필이 아니라 로그인 플래그(isAuthenticated)로 정한다 - 프로필은 로그인 뒤에
// 따로 받아 오므로 조회 전·실패 때 비로그인으로 잘못 보인다(docs/AUTH.md §5 "/auth/verify-email")
function renderWithToken(token = 'valid-token') {
  return renderWithProviders(<VerifyEmailStatus />, {
    wrapperOptions: { initialEntries: [`/auth/verify-email?token=${token}`] },
  });
}

describe('VerifyEmailStatus', () => {
  beforeEach(() => {
    useAuthStore.getState().setAuthResolved(false);
  });

  afterEach(() => {
    useAuthStore.getState().setAuthResolved(false);
  });

  it('로그인 상태면 계정 정보를 받기 전에도 인증 완료 화면에 피드로 가는 버튼을 보여준다', async () => {
    server.use(
      http.get(url(API_ENDPOINTS.auth.account), async () => {
        await delay('infinite');
        return HttpResponse.json({});
      })
    );
    useAuthStore.getState().setAuth('token');
    useAuthStore.getState().setAuthResolved(true);

    renderWithToken();

    expect(
      await screen.findByRole('link', { name: TEXTS.auth.verifyEmail.goToFeed })
    ).toBeVisible();
  });

  it('인증 복원이 끝나기 전에는 확인 중 화면을 유지하고, 끝나면 결과에 맞는 버튼을 보여준다', async () => {
    const { queryClient } = renderWithToken();

    // 확인 요청은 복원과 상관없이 먼저 끝날 수 있다 - 그래도 로그인 여부를 모르는 동안엔 버튼을 정하지 않는다
    await waitFor(() =>
      expect(queryClient.getMutationCache().getAll()[0]?.state.status).toBe('success')
    );
    expect(screen.getByText(TEXTS.auth.verifyEmail.pendingTitle)).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    act(() => useAuthStore.getState().setAuthResolved(true));

    expect(screen.getByText(TEXTS.auth.verifyEmail.successTitle)).toBeVisible();
    expect(screen.getByRole('link', { name: TEXTS.auth.verifyEmail.goToLogin })).toBeVisible();
  });

  it('인증에 실패했어도 로그인 상태면 계정 설정으로 가는 버튼을 보여준다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.auth.emailVerificationConfirm), () =>
        HttpResponse.json(
          { status: 401, code: 'INVALID_ACTION_TOKEN', message: 'invalid', timestamp: '' },
          { status: 401 }
        )
      ),
      http.get(url(API_ENDPOINTS.auth.account), async () => {
        await delay('infinite');
        return HttpResponse.json({});
      })
    );
    useAuthStore.getState().setAuth('token');
    useAuthStore.getState().setAuthResolved(true);

    renderWithToken('expired-token');

    expect(
      await screen.findByRole('link', { name: TEXTS.auth.verifyEmail.goToAccountSettings })
    ).toBeVisible();
  });
});
