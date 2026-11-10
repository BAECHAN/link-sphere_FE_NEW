import { describe, it, expect, afterEach } from 'vitest';
import { useLocation, useNavigate, type MemoryRouterProps } from 'react-router-dom';
import { act, renderHookWithDataRouter } from '@/test/utils';
import { useProtectedNavigate } from '@/entities/auth/hooks/useProtectedNavigate';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';

type Rendered = ReturnType<typeof renderProtectedNavigate>['result'];

// 로그인 창을 여는 쪽이 라우터가 가 있는 위치를 읽으므로(useBackClosableOverlay) 앱과 같은 데이터 라우터로 그린다.
// 화면에 반영된 위치(useLocation)와 뒤로가기(navigate(-1))를 함께 돌려받아 히스토리를 되짚는다.
function renderProtectedNavigate(initialEntries: MemoryRouterProps['initialEntries'] = ['/from']) {
  return renderHookWithDataRouter(
    () => ({
      protectedNavigate: useProtectedNavigate(),
      location: useLocation(),
      navigate: useNavigate(),
    }),
    { wrapperOptions: { initialEntries } }
  );
}

function getOverlayState(result: Rendered) {
  const state = result.current.location.state as {
    loginDialogOpen?: boolean;
    sidebarOpen?: boolean;
  } | null;

  return {
    isLoginDialogOpen: Boolean(state?.loginDialogOpen),
    isSidebarOpen: Boolean(state?.sidebarOpen),
  };
}

function goBack(result: Rendered) {
  act(() => {
    result.current.navigate(-1);
  });
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
    const { result } = renderProtectedNavigate();

    act(() => result.current.protectedNavigate('/to'));

    expect(result.current.location.pathname).toBe('/to');
  });

  it('비로그인이면 이동하지 않고 로그인 모달을 연다', () => {
    const { result } = renderProtectedNavigate();

    act(() => result.current.protectedNavigate('/to'));

    expect(result.current.location.pathname).toBe('/from');
    expect(getOverlayState(result).isLoginDialogOpen).toBe(true);
  });

  it('비로그인 후 로그인 성공 콜백은 push가 아니라 replace로 이동한다 (orphan 히스토리 방지)', () => {
    const { result } = renderProtectedNavigate();

    act(() => result.current.protectedNavigate('/to'));
    // 로그인 모달을 여는 push가 한 번 일어난 상태 (pathname은 그대로, state만 실림)
    expect(result.current.location.pathname).toBe('/from');

    act(() => {
      useLoginDialogStore.getState().onSuccess?.();
    });
    expect(result.current.location.pathname).toBe('/to');

    // replace였다면 뒤로가기 한 번으로 "로그인모달 열림" 엔트리를 거치지 않고 원래 /from으로 바로 돌아간다.
    // push였다면 그 엔트리가 orphan으로 남아 여기서 로그인 모달이 열린 /from을 다시 보게 된다.
    goBack(result);
    expect(result.current.location.pathname).toBe('/from');
    expect(getOverlayState(result).isLoginDialogOpen).toBe(false);
  });

  describe('replace 옵션 (모바일 메뉴 엔트리에서 떠날 때)', () => {
    function renderFromDrawerEntry() {
      return renderProtectedNavigate(DRAWER_ENTRIES);
    }

    function expectBackToEntryBelowDrawer(result: Rendered) {
      goBack(result);
      expect(getOverlayState(result).isSidebarOpen).toBe(false);
      expect(result.current.location.pathname).toBe('/from');
      expect(getOverlayState(result).isLoginDialogOpen).toBe(false);
    }

    it('로그인 상태면 메뉴 엔트리를 대상 경로로 교체해, 뒤로 와도 메뉴가 안 열린다', () => {
      useAuthStore.getState().setAuth('token');
      const { result } = renderFromDrawerEntry();

      act(() => result.current.protectedNavigate('/to', { replace: true }));

      expect(result.current.location.pathname).toBe('/to');
      expectBackToEntryBelowDrawer(result);
    });

    it('비로그인이면 로그인 창이 메뉴 엔트리를 대체해, 취소해도 메뉴가 안 열린다', () => {
      const { result } = renderFromDrawerEntry();

      act(() => result.current.protectedNavigate('/to', { replace: true }));

      expect(result.current.location.pathname).toBe('/from');
      expect(getOverlayState(result).isLoginDialogOpen).toBe(true);
      expect(getOverlayState(result).isSidebarOpen).toBe(false);
      expectBackToEntryBelowDrawer(result);
    });

    it('비로그인 후 로그인에 성공해 이동한 뒤 뒤로 와도 메뉴·로그인 창이 안 열린다', () => {
      const { result } = renderFromDrawerEntry();

      act(() => result.current.protectedNavigate('/to', { replace: true }));
      act(() => {
        useLoginDialogStore.getState().onSuccess?.();
      });
      expect(result.current.location.pathname).toBe('/to');

      expectBackToEntryBelowDrawer(result);
    });
  });
});
