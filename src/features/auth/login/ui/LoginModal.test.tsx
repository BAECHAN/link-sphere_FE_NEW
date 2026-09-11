import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithProviders, userEvent } from '@/test/utils';
import { LoginModal } from '@/features/auth/login/ui/LoginModal';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';

// 이 테스트는 LoginModal의 열림/닫힘 전이와 pendingAction 재개 타이밍만 검증한다 -
// 실제 로그인 폼 제출·네트워크는 useLogin.test.ts 등 다른 테스트의 책임이므로 스텁한다.
vi.mock('@/features/auth/login/ui/LoginForm', () => ({
  LoginForm: () => <div>login-form</div>,
}));

/** location.state.loginModalOpen 여부를 화면에 노출해 확인한다 (useAuthGuard.test.tsx 선례). */
function LoginModalStateProbe() {
  const location = useLocation();
  const state = location.state as { loginModalOpen?: boolean } | null;
  return <div data-testid="login-modal-open">{String(Boolean(state?.loginModalOpen))}</div>;
}

/** navigate(-1)이 갈 곳이 있도록 엔트리 2개로 렌더한다 - 마지막 엔트리가 모달이 열린 상태다. */
function renderOpenModal() {
  return renderWithProviders(
    <>
      <LoginModal />
      <LoginModalStateProbe />
    </>,
    {
      wrapperOptions: {
        initialEntries: [
          { pathname: '/post' },
          { pathname: '/post', state: { loginModalOpen: true } },
        ],
      },
    }
  );
}

describe('LoginModal', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useLoginModalStore.getState().setOnSuccess(undefined);
    useLoginModalStore.getState().setPendingAction(undefined);
  });

  it('pendingAction은 이 모달의 히스토리 엔트리가 실제로 닫힌 뒤에만 실행한다', () => {
    // 겹침 회귀 테스트: "몇 틱 뒤"라는 시간이 아니라, 실행되는 시점에 이 모달의 open
    // 상태(location.state.loginModalOpen)가 이미 false인지를 본다. Radix Dialog는
    // exit 애니메이션 때문에 data-state="closed"가 된 뒤에도 DOM 노드가 잠시 남아있어
    // "화면에서 사라짐"을 DOM 존재 여부로 판단하면 안 된다 - 이 코드가 실제로 보장하는
    // 것은 history 상태 기준의 닫힘이다.
    const pendingAction = vi.fn(() => {
      expect(screen.getByTestId('login-modal-open')).toHaveTextContent('false');
    });
    useLoginModalStore.getState().setPendingAction(pendingAction);
    renderOpenModal();

    act(() => {
      useAuthStore.getState().setAuth('token');
    });

    expect(pendingAction).toHaveBeenCalledTimes(1);
    expect(useLoginModalStore.getState().pendingAction).toBeUndefined();
  });

  it('취소(ESC)로 닫히면 pendingAction을 실행하지 않고 버린다', async () => {
    const pendingAction = vi.fn();
    useLoginModalStore.getState().setPendingAction(pendingAction);
    const user = userEvent.setup();
    renderOpenModal();

    await user.keyboard('{Escape}');

    expect(screen.getByTestId('login-modal-open')).toHaveTextContent('false');
    expect(pendingAction).not.toHaveBeenCalled();
    expect(useLoginModalStore.getState().pendingAction).toBeUndefined();
  });

  it('onSuccess가 있으면 그 분기만 타고 pendingAction은 건드리지 않는다', () => {
    const onSuccess = vi.fn();
    const pendingAction = vi.fn();
    useLoginModalStore.getState().setOnSuccess(onSuccess);
    useLoginModalStore.getState().setPendingAction(pendingAction);
    renderOpenModal();

    act(() => {
      useAuthStore.getState().setAuth('token');
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(pendingAction).not.toHaveBeenCalled();
  });
});
