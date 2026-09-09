import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';

/** location.state.loginModalOpen 여부를 화면에 노출해 확인한다 (NavbarSearch.test.tsx 선례). */
function LoginModalStateProbe() {
  const location = useLocation();
  const state = location.state as { loginModalOpen?: boolean } | null;
  return <div data-testid="login-modal-open">{String(Boolean(state?.loginModalOpen))}</div>;
}

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        {children}
        <LoginModalStateProbe />
      </MemoryRouter>
    );
  };
}

describe('useAuthGuard', () => {
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    useLoginModalStore.getState().setOnSuccess(undefined);
  });

  it('로그인 상태면 action을 그대로 실행한다', () => {
    useAuthStore.getState().setAuth('token');
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    act(() => result.current(action));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-modal-open')).toHaveTextContent('false');
  });

  it('비로그인이면 action을 실행하지 않고 로그인 모달을 연다', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    act(() => result.current(action));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-modal-open')).toHaveTextContent('true');
  });

  it('비로그인이면 이전에 남아있던 로그인 성공 콜백을 비운다', () => {
    const staleCallback = vi.fn();
    useLoginModalStore.getState().setOnSuccess(staleCallback);
    const { result } = renderHook(() => useAuthGuard(), { wrapper: createWrapper() });

    result.current(vi.fn());

    expect(useLoginModalStore.getState().onSuccess).toBeUndefined();
  });
});
