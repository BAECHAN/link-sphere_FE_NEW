import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLocation, useNavigate } from 'react-router-dom';
import { act, renderHookWithDataRouter } from '@/test/utils';
import { useLoginDialog } from '@/widgets/layout/login-dialog/hooks/useLoginDialog';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { useAuthStore } from '@/shared/store/auth.store';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

type Entry = { pathname: string; state?: Record<string, unknown> };

const OPEN_STATE = { loginDialogOpen: true };

// 열림을 라우터가 가 있는 위치에서 읽으므로(useBackClosableOverlay) 앱과 같은 데이터 라우터로 그린다
function setup(entries: Entry[]) {
  return renderHookWithDataRouter(
    () => ({
      dialog: useLoginDialog(),
      navigate: useNavigate(),
      location: useLocation(),
    }),
    { wrapperOptions: { initialEntries: entries } }
  );
}

/** 닫힌 '/' 뒤에 열린 '/' 엔트리가 쌓인 상태 */
function setupOpen(state: Record<string, unknown> = OPEN_STATE) {
  return setup([{ pathname: '/' }, { pathname: '/', state }]);
}

function login() {
  act(() => {
    useAuthStore.setState({ isAuthenticated: true });
  });
}

describe('useLoginDialog', () => {
  beforeEach(() => {
    useLoginDialogStore.setState({ onSuccess: undefined, pendingAction: undefined });
    useAuthStore.setState({ isAuthenticated: false });
  });

  describe('열림 상태와 이유', () => {
    it('history state에 loginDialogOpen이 있으면 열려 있고, 없으면 닫혀 있다', () => {
      expect(setupOpen().result.current.dialog.isOpen).toBe(true);
      expect(setup([{ pathname: '/' }]).result.current.dialog.isOpen).toBe(false);
    });

    it('열려 있는 동안 history state의 이유가 바뀌면 따라간다', () => {
      const { result } = setupOpen({ ...OPEN_STATE, loginDialogReason: 'expired' });

      expect(result.current.dialog.reason).toBe('expired');

      act(() => {
        result.current.navigate('/', {
          state: { ...OPEN_STATE, loginDialogReason: 'signedOutElsewhere' },
        });
      });

      expect(result.current.dialog.reason).toBe('signedOutElsewhere');
    });

    it('닫히는 동안에도 열려 있던 때의 이유를 유지한다', () => {
      const { result } = setupOpen({ ...OPEN_STATE, loginDialogReason: 'expired' });

      act(() => {
        result.current.dialog.handleOpenChange(false);
      });

      expect(result.current.dialog.isOpen).toBe(false);
      expect(result.current.dialog.reason).toBe('expired');
    });
  });

  describe('닫기', () => {
    it('닫으면 로그인 성공 콜백을 비우고 이전 엔트리로 돌아간다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      const { result } = setupOpen();

      act(() => {
        result.current.dialog.handleOpenChange(false);
      });

      expect(result.current.dialog.isOpen).toBe(false);
      expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('열라는 변경에는 아무것도 하지 않는다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      const { result } = setupOpen();

      act(() => {
        result.current.dialog.handleOpenChange(true);
      });

      expect(result.current.dialog.isOpen).toBe(true);
      expect(useLoginDialogStore.getState().onSuccess).toBe(onSuccess);
    });

    it.each([
      ['로그인', ROUTES_PATHS.AUTH.LOGIN],
      ['회원가입', ROUTES_PATHS.AUTH.SIGNUP],
    ])('열린 채 %s 페이지에 있으면 콜백을 실행하지 않고 닫는다', (_name, pathname) => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      const { result } = setup([{ pathname: '/' }, { pathname, state: OPEN_STATE }]);

      expect(result.current.dialog.isOpen).toBe(false);
      expect(result.current.location.pathname).toBe('/');
      expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('auth 페이지에서 창이 열리면 콜백을 비우고 그 엔트리에서 벗어난다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      const { result } = setup([{ pathname: ROUTES_PATHS.AUTH.SIGNUP }]);

      act(() => {
        result.current.navigate(ROUTES_PATHS.AUTH.SIGNUP, { state: OPEN_STATE });
      });

      expect(result.current.dialog.isOpen).toBe(false);
      expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('회원가입 화면에서 뒤로 와 창이 열린 칸으로 돌아오면 창이 다시 열려 있다', () => {
      // 창 안의 회원가입 링크는 창이 열린 칸 위에 회원가입 화면을 쌓는다. 뒤로 오는 순간 라우터는 이미 창이 열린
      // 칸에 있고 화면은 아직 회원가입 화면이다 - 그 화면(커밋된 위치)으로 "auth 페이지에서 열렸다"를 판정하면
      // 돌아온 창을 닫고 한 칸 더 뒤로 간다
      const { result } = setup([
        { pathname: '/' },
        { pathname: '/', state: OPEN_STATE },
        { pathname: ROUTES_PATHS.AUTH.SIGNUP },
      ]);

      act(() => {
        result.current.navigate(-1);
      });

      expect(result.current.dialog.isOpen).toBe(true);
      expect(result.current.location.state).toEqual(OPEN_STATE);
    });

    it('auth 페이지가 아니면 열린 채로 콜백도 유지한다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      const { result } = setup([{ pathname: '/' }, { pathname: '/posts', state: OPEN_STATE }]);

      expect(result.current.dialog.isOpen).toBe(true);
      expect(useLoginDialogStore.getState().onSuccess).toBe(onSuccess);
    });

    it('닫힌 채 auth 페이지에 있어도 콜백을 건드리지 않는다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      setup([{ pathname: ROUTES_PATHS.AUTH.LOGIN }]);

      expect(useLoginDialogStore.getState().onSuccess).toBe(onSuccess);
    });
  });

  describe('로그인 성공', () => {
    it('콜백이 있으면 실행하고 비우되 스스로 닫지는 않는다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      const { result } = setupOpen();

      login();

      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(useLoginDialogStore.getState().onSuccess).toBeUndefined();
      expect(result.current.dialog.isOpen).toBe(true);
    });

    it('콜백이 없으면 창을 닫는다', () => {
      const { result } = setupOpen();

      login();

      expect(result.current.dialog.isOpen).toBe(false);
    });

    it('닫혀 있을 때의 로그인은 콜백을 실행하지 않는다', () => {
      const onSuccess = vi.fn();
      useLoginDialogStore.setState({ onSuccess });
      setup([{ pathname: '/' }]);

      login();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(useLoginDialogStore.getState().onSuccess).toBe(onSuccess);
    });

    it('창을 닫았다 다시 열면 새 콜백이 다시 실행된다', () => {
      const first = vi.fn();
      const second = vi.fn();
      useLoginDialogStore.setState({ onSuccess: first });
      const { result } = setupOpen();

      login();
      expect(first).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.navigate(-1);
      });
      act(() => {
        useAuthStore.setState({ isAuthenticated: false });
      });
      act(() => {
        result.current.navigate('/', { state: OPEN_STATE });
      });
      act(() => {
        useLoginDialogStore.setState({ onSuccess: second });
      });
      login();

      expect(second).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledTimes(1);
    });
  });

  describe('재개 액션', () => {
    it('로그인 성공으로 창이 닫힌 뒤 한 번 실행하고 비운다', () => {
      const pendingAction = vi.fn();
      useLoginDialogStore.setState({ pendingAction });
      const { result } = setupOpen();

      expect(pendingAction).not.toHaveBeenCalled();

      login();

      expect(result.current.dialog.isOpen).toBe(false);
      expect(pendingAction).toHaveBeenCalledTimes(1);
      expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
    });

    it('로그인 없이 닫히면 실행하지 않고 버린다', () => {
      const pendingAction = vi.fn();
      useLoginDialogStore.setState({ pendingAction });
      const { result } = setupOpen();

      act(() => {
        result.current.dialog.handleOpenChange(false);
      });

      expect(pendingAction).not.toHaveBeenCalled();
      expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
    });

    it('창이 한 번도 열리지 않았으면 대기 중인 액션을 버리지 않는다', () => {
      const pendingAction = vi.fn();
      setup([{ pathname: '/' }]);

      act(() => {
        useLoginDialogStore.setState({ pendingAction });
      });

      expect(pendingAction).not.toHaveBeenCalled();
      expect(useLoginDialogStore.getState().pendingAction).toBe(pendingAction);
    });

    it('한 번 처리된 뒤 새로 등록된 액션은 다시 열릴 때까지 기다린다', () => {
      const first = vi.fn();
      const second = vi.fn();
      useLoginDialogStore.setState({ pendingAction: first });
      setupOpen();

      login();
      expect(first).toHaveBeenCalledTimes(1);

      act(() => {
        useAuthStore.setState({ isAuthenticated: false });
      });
      act(() => {
        useLoginDialogStore.setState({ pendingAction: second });
      });

      expect(second).not.toHaveBeenCalled();
      expect(useLoginDialogStore.getState().pendingAction).toBe(second);
    });
  });

  describe('입력 여부', () => {
    it('처음에는 입력이 없고, 알린 값을 그대로 반영한다', () => {
      const { result } = setupOpen();

      expect(result.current.dialog.hasUserInput).toBe(false);

      act(() => {
        result.current.dialog.handleInputDirtyChange(true);
      });
      expect(result.current.dialog.hasUserInput).toBe(true);

      act(() => {
        result.current.dialog.handleInputDirtyChange(false);
      });
      expect(result.current.dialog.hasUserInput).toBe(false);
    });
  });
});
