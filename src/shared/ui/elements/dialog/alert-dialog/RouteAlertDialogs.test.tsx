import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@/test/utils';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import {
  getOpenAlertDialogId,
  useAlertDialogStore,
} from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { RouteAlertDialogs } from '@/shared/ui/elements/dialog/alert-dialog/RouteAlertDialogs';

// 확인창은 히스토리 칸에 묶이지 않아, 열린 위치를 벗어나면(뒤로가기·링크 이동) 취소로 닫아야 한다.
// 앱(RootLayout)처럼 라우터 아래에 확인창을 함께 띄워 그 동작을 본다.

const CONFIRM_MESSAGE = 'confirm-message';

function Layout() {
  return (
    <>
      <Outlet />
      <RouteAlertDialogs />
    </>
  );
}

function renderWithRouter() {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/a', element: <div data-testid="page-a" /> },
          { path: '/b', element: <div data-testid="page-b" /> },
        ],
      },
    ],
    { initialEntries: ['/a'] }
  );

  render(<RouterProvider router={router} future={{ v7_startTransition: true }} />);

  return router;
}

function openConfirm(onCancel?: () => void) {
  act(() => {
    useAlertDialogStore.getState().openConfirm({ message: CONFIRM_MESSAGE, onCancel });
  });
}

describe('RouteAlertDialogs', () => {
  beforeEach(() => {
    useAlertDialogStore.setState({ dialogs: [] });
  });

  it('확인창이 열린 뒤 다른 경로로 이동하면 취소로 닫힌다', async () => {
    const router = renderWithRouter();
    const onCancel = vi.fn();

    openConfirm(onCancel);
    expect(await screen.findByText(CONFIRM_MESSAGE)).toBeInTheDocument();

    await act(async () => {
      await router.navigate('/b');
    });

    expect(getOpenAlertDialogId()).toBeNull();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('경로는 같고 쿼리만 바뀌어도 닫힌다', async () => {
    const router = renderWithRouter();
    const onCancel = vi.fn();

    openConfirm(onCancel);
    await screen.findByText(CONFIRM_MESSAGE);

    await act(async () => {
      await router.navigate('/a?folder=1');
    });

    expect(getOpenAlertDialogId()).toBeNull();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('이동하지 않으면 열려 있다', async () => {
    renderWithRouter();
    const onCancel = vi.fn();

    openConfirm(onCancel);
    await screen.findByText(CONFIRM_MESSAGE);

    expect(getOpenAlertDialogId()).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('이동한 뒤에 연 확인창은 열려 있다', async () => {
    const router = renderWithRouter();
    const onCancel = vi.fn();

    await act(async () => {
      await router.navigate('/b');
    });

    openConfirm(onCancel);
    await screen.findByText(CONFIRM_MESSAGE);

    expect(getOpenAlertDialogId()).not.toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
