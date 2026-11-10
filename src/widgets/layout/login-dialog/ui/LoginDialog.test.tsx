import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import { renderWithDataRouter, userEvent } from '@/test/utils';
import { LoginDialog } from '@/widgets/layout/login-dialog/ui/LoginDialog';
import { useAuthStore } from '@/shared/store/auth.store';
import {
  SIGNED_OUT_IN_PLACE_DIALOG_STATE,
  useLoginDialogStore,
} from '@/shared/store/loginDialog.store';
import { TEXTS } from '@/shared/config/texts';

// 이 테스트는 LoginDialog의 열림/닫힘 전이와 pendingAction 재개 타이밍만 검증한다 -
// 실제 로그인 폼 제출·네트워크는 useLogin.test.ts 등 다른 테스트의 책임이므로 스텁한다.
vi.mock('@/features/auth/login/ui/LoginForm', () => ({
  LoginForm: () => <div>login-form</div>,
}));

/**
 * navigate(-1)이 갈 곳이 있도록 엔트리 2개로 렌더한다 - 마지막 엔트리가 모달이 열린 상태다.
 * 열림을 라우터가 가 있는 위치에서 읽으므로(useBackClosableOverlay) 앱과 같은 데이터 라우터로 그린다.
 */
function renderOpenDialog() {
  return renderWithDataRouter(<LoginDialog />, {
    wrapperOptions: {
      initialEntries: [
        { pathname: '/post' },
        { pathname: '/post', state: { loginDialogOpen: true } },
      ],
    },
  });
}

type Router = ReturnType<typeof renderOpenDialog>['router'];

/** 라우터가 가 있는 칸이 로그인 창을 연 칸인지 - 창의 열림이 이 값을 따른다 */
function isOnLoginDialogEntry(router: Router) {
  const state = router.state.location.state as { loginDialogOpen?: boolean } | null;

  return Boolean(state?.loginDialogOpen);
}

describe('LoginDialog', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useLoginDialogStore.getState().setOnSuccess(undefined);
    useLoginDialogStore.getState().setPendingAction(undefined);
  });

  it('pendingAction은 이 모달의 히스토리 엔트리가 실제로 닫힌 뒤에만 실행한다', () => {
    // 겹침 회귀 테스트: "몇 틱 뒤"라는 시간이 아니라, 실행되는 시점에 이 모달의 open
    // 상태(라우터가 가 있는 칸의 state.loginDialogOpen)가 이미 false인지를 본다. Radix Dialog는
    // exit 애니메이션 때문에 data-state="closed"가 된 뒤에도 DOM 노드가 잠시 남아있어
    // "화면에서 사라짐"을 DOM 존재 여부로 판단하면 안 된다 - 이 코드가 실제로 보장하는
    // 것은 history 상태 기준의 닫힘이다.
    const pendingAction = vi.fn(() => {
      expect(isOnLoginDialogEntry(router)).toBe(false);
    });
    useLoginDialogStore.getState().setPendingAction(pendingAction);
    const { router } = renderOpenDialog();

    act(() => {
      useAuthStore.getState().setAuth('token');
    });

    expect(pendingAction).toHaveBeenCalledTimes(1);
    expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
  });

  it('취소(ESC)로 닫히면 pendingAction을 실행하지 않고 버린다', async () => {
    const pendingAction = vi.fn();
    useLoginDialogStore.getState().setPendingAction(pendingAction);
    const user = userEvent.setup();
    const { router } = renderOpenDialog();

    await user.keyboard('{Escape}');

    expect(isOnLoginDialogEntry(router)).toBe(false);
    expect(pendingAction).not.toHaveBeenCalled();
    expect(useLoginDialogStore.getState().pendingAction).toBeUndefined();
  });

  it('onSuccess가 있으면 그 분기만 타고 pendingAction은 건드리지 않는다', () => {
    const onSuccess = vi.fn();
    const pendingAction = vi.fn();
    useLoginDialogStore.getState().setOnSuccess(onSuccess);
    useLoginDialogStore.getState().setPendingAction(pendingAction);
    renderOpenDialog();

    act(() => {
      useAuthStore.getState().setAuth('token');
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(pendingAction).not.toHaveBeenCalled();
  });

  it('이유 없이 연 창은 기본 문구를 쓴다', () => {
    renderOpenDialog();

    expect(screen.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeInTheDocument();
    expect(screen.getByText(TEXTS.auth.description)).toBeInTheDocument();
  });

  it.each(['expired', 'signedOutElsewhere'] as const)(
    '로그인이 풀린 화면에서 연 창(%s)은 그 이유를 제목·설명으로 알린다',
    (reason) => {
      renderWithDataRouter(<LoginDialog />, {
        wrapperOptions: {
          initialEntries: [
            { pathname: '/post/submit' },
            { pathname: '/post/submit', state: SIGNED_OUT_IN_PLACE_DIALOG_STATE[reason] },
          ],
        },
      });

      expect(
        screen.getByRole('dialog', { name: TEXTS.auth.guard[reason].title })
      ).toBeInTheDocument();
      expect(screen.getByText(TEXTS.auth.guard[reason].description)).toBeInTheDocument();
    }
  );
});
