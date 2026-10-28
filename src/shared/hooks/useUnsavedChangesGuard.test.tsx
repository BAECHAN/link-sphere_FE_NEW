import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { clearUnsavedChanges, useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { getOpenAlertId, useAlertStore } from '@/shared/ui/elements/dialog/alert/alert.store';
import { GlobalAlerts } from '@/shared/ui/elements/dialog/alert/Alert';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';

// useBlocker는 데이터 라우터에서만 동작한다 - renderWithProviders(MemoryRouter) 대신
// createMemoryRouter로 앱(RootLayout)처럼 가드와 GlobalAlerts를 함께 띄운다.

function GuardLayout() {
  useUnsavedChangesGuard();

  return (
    <>
      <Outlet />
      <GlobalAlerts />
    </>
  );
}

function TwoDirtyForms() {
  useUnsavedChanges('form-a', true);
  useUnsavedChanges('form-b', true);

  return <div data-testid="form" />;
}

function renderGuard() {
  const router = createMemoryRouter(
    [
      {
        element: <GuardLayout />,
        children: [
          { path: '/form', element: <TwoDirtyForms /> },
          { path: '/other', element: <div data-testid="other" /> },
        ],
      },
    ],
    { initialEntries: ['/form'] }
  );

  render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);

  return router;
}

describe('useUnsavedChangesGuard', () => {
  beforeEach(() => {
    useAlertStore.setState({ alerts: [] });
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
    useAuthStore.getState().setAuth('test-access-token');
  });

  it('이탈 확인창이 떠 있는 동안 작성 중인 폼이 모두 해제되면 확인창을 닫고 막혔던 이동은 취소한다', async () => {
    const router = renderGuard();

    await act(async () => {
      await router.navigate('/other');
    });

    expect(
      await screen.findByRole('alertdialog', { name: TEXTS.unsavedChanges.title })
    ).toBeInTheDocument();

    // 아직 다른 폼에 작성 중인 내용이 남아 있으면 확인창의 전제가 그대로라 닫지 않는다
    act(() => {
      clearUnsavedChanges('form-a');
    });

    expect(getOpenAlertId()).not.toBeNull();

    act(() => {
      clearUnsavedChanges('form-b');
    });

    expect(getOpenAlertId()).toBeNull();
    expect(router.state.location.pathname).toBe('/form');

    // 막혔던 이동이 취소(reset)됐으니 다시 이동하면 그대로 통과한다
    await act(async () => {
      await router.navigate('/other');
    });

    expect(router.state.location.pathname).toBe('/other');
    expect(screen.getByTestId('other')).toBeInTheDocument();
  });
});

describe('useUnsavedChangesGuard — 로그인이 풀린 상태', () => {
  beforeEach(() => {
    useAlertStore.setState({ alerts: [] });
    useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
  });

  it('로그인이 풀린 채 쓰던 화면에 둔 동안(signedOutInPlace)에는 평소처럼 이탈을 막는다', async () => {
    useAuthStore.getState().expireSession('/form');
    const router = renderGuard();

    await act(async () => {
      await router.navigate('/other');
    });

    expect(
      await screen.findByRole('alertdialog', { name: TEXTS.unsavedChanges.title })
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/form');
  });

  it('그 표시가 없는 로그아웃 상태면 지금처럼 막지 않는다 - 보호 화면의 강제 이동에 갇히지 않게', async () => {
    useAuthStore.getState().clearAuth();
    const router = renderGuard();

    await act(async () => {
      await router.navigate('/other');
    });

    expect(router.state.location.pathname).toBe('/other');
    expect(getOpenAlertId()).toBeNull();
  });
});
