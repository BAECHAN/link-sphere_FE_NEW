import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, type MemoryRouterProps } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useProtectedNavigate } from '@/entities/auth/hooks/useProtectedNavigate';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';

/** 현재 경로·로그인모달 state를 노출하고, "back" 버튼으로 히스토리를 되짚을 수 있게 한다. */
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { loginDialogOpen?: boolean; sidebarOpen?: boolean } | null;
  return (
    <div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="login-dialog-open">{String(Boolean(state?.loginDialogOpen))}</div>
      <div data-testid="sidebar-open">{String(Boolean(state?.sidebarOpen))}</div>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
}

function createWrapper(initialEntries: MemoryRouterProps['initialEntries'] = ['/from']) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        {children}
        <LocationProbe />
      </MemoryRouter>
    );
  };
}

// 모바일 메뉴 엔트리에서 떠나는 상황: [/from, /from + 메뉴 열림]
const DRAWER_ENTRIES = ['/from', { pathname: '/from', state: { sidebarOpen: true } }];

describe('useProtectedNavigate', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useLoginDialogStore.getState().setOnSuccess(undefined);
  });

  it('로그인 상태면 즉시 대상 경로로 이동한다', () => {
    useAuthStore.getState().setAuth('token');
    const { result } = renderHook(() => useProtectedNavigate(), { wrapper: createWrapper() });

    act(() => result.current('/to'));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/to');
  });

  it('비로그인이면 이동하지 않고 로그인 모달을 연다', () => {
    const { result } = renderHook(() => useProtectedNavigate(), { wrapper: createWrapper() });

    act(() => result.current('/to'));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/from');
    expect(screen.getByTestId('login-dialog-open')).toHaveTextContent('true');
  });

  it('비로그인 후 로그인 성공 콜백은 push가 아니라 replace로 이동한다 (orphan 히스토리 방지)', async () => {
    const { result } = renderHook(() => useProtectedNavigate(), { wrapper: createWrapper() });

    act(() => result.current('/to'));
    // 로그인 모달을 여는 push가 한 번 일어난 상태 (pathname은 그대로, state만 실림)
    expect(screen.getByTestId('pathname')).toHaveTextContent('/from');

    act(() => {
      useLoginDialogStore.getState().onSuccess?.();
    });
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/to'));

    // replace였다면 뒤로가기 한 번으로 "로그인모달 열림" 엔트리를 거치지 않고 원래 /from으로 바로 돌아간다.
    // push였다면 그 엔트리가 orphan으로 남아 여기서 login-dialog-open=true인 /from을 다시 보게 된다.
    fireEvent.click(screen.getByText('back'));
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/from'));
    expect(screen.getByTestId('login-dialog-open')).toHaveTextContent('false');
  });

  describe('replace 옵션 (모바일 메뉴 엔트리에서 떠날 때)', () => {
    function renderFromDrawerEntry() {
      return renderHook(() => useProtectedNavigate(), {
        wrapper: createWrapper(DRAWER_ENTRIES),
      });
    }

    async function expectBackToEntryBelowDrawer() {
      fireEvent.click(screen.getByText('back'));
      await waitFor(() => expect(screen.getByTestId('sidebar-open')).toHaveTextContent('false'));
      expect(screen.getByTestId('pathname')).toHaveTextContent('/from');
      expect(screen.getByTestId('login-dialog-open')).toHaveTextContent('false');
    }

    it('로그인 상태면 메뉴 엔트리를 대상 경로로 교체해, 뒤로 와도 메뉴가 안 열린다', async () => {
      useAuthStore.getState().setAuth('token');
      const { result } = renderFromDrawerEntry();

      act(() => result.current('/to', { replace: true }));

      expect(screen.getByTestId('pathname')).toHaveTextContent('/to');
      await expectBackToEntryBelowDrawer();
    });

    it('비로그인이면 로그인 창이 메뉴 엔트리를 대체해, 취소해도 메뉴가 안 열린다', async () => {
      const { result } = renderFromDrawerEntry();

      act(() => result.current('/to', { replace: true }));

      expect(screen.getByTestId('pathname')).toHaveTextContent('/from');
      expect(screen.getByTestId('login-dialog-open')).toHaveTextContent('true');
      expect(screen.getByTestId('sidebar-open')).toHaveTextContent('false');
      await expectBackToEntryBelowDrawer();
    });

    it('비로그인 후 로그인에 성공해 이동한 뒤 뒤로 와도 메뉴·로그인 창이 안 열린다', async () => {
      const { result } = renderFromDrawerEntry();

      act(() => result.current('/to', { replace: true }));
      act(() => {
        useLoginDialogStore.getState().onSuccess?.();
      });
      await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/to'));

      await expectBackToEntryBelowDrawer();
    });
  });
});
