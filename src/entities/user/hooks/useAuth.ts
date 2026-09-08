import { useCallback } from 'react';
import { useAuthStore } from '@/shared/store/auth.store';
import { useShallow } from 'zustand/react/shallow';
import { authApi } from '@/entities/user/api/auth.api';
import { useLoginMutation, useLogoutMutation } from '@/entities/user/api/auth.queries';
import { Login } from '@/shared/types/auth.type';
import { Account } from '@/shared/types/auth.type';

// ==================== Types ====================

type AuthActions = {
  login: (data: Login) => Promise<void>;
  restoreAuth: () => Promise<boolean>;
  logout: () => void;
  setAuth: (accessToken: string | null, user?: Account | null) => void;
};

type AuthState =
  | {
      isAuthenticated: false;
      accessToken: null;
    }
  | {
      isAuthenticated: true;
      accessToken: string;
    };

type UseAuthReturn = AuthState &
  AuthActions & {
    isLoginPending: boolean;
  };

// ==================== Hook ====================

/**
 * 통합 인증 관리 훅
 */
export const useAuth = (): UseAuthReturn => {
  const { accessToken, setAuth, clearAuth, isAuthenticated } = useAuthStore(
    useShallow((state) => ({
      accessToken: state.accessToken,
      setAuth: state.setAuth,
      clearAuth: state.clearAuth,
      isAuthenticated: state.isAuthenticated,
    }))
  );

  const { mutate: logout } = useLogoutMutation();
  const { mutateAsync: loginMutation, isPending: isLoginPending } = useLoginMutation();

  // 로그인 처리 함수
  const login = useCallback(
    async (data: Login) => {
      try {
        await loginMutation(data);
      } catch (error) {
        console.error('Login failed', error);
      }
    },
    [loginMutation]
  );

  // 토큰 복원 함수
  const restoreAuth = useCallback(async (): Promise<boolean> => {
    try {
      if (accessToken && isAuthenticated) {
        return true;
      }

      const authData = await authApi.refresh();

      if (!authData || !authData.accessToken) {
        clearAuth();
        return false;
      }

      setAuth(authData.accessToken);
      return true;
    } catch (error) {
      console.error('Auth restore failed', error);
      clearAuth();
      return false;
    }
  }, [accessToken, isAuthenticated, setAuth, clearAuth]);

  // 공통 액션
  const actions = {
    login,
    restoreAuth,
    logout,
    setAuth,
    isLoginPending,
  };

  // Discriminated Union 반환
  // isAuthenticated가 true이고 모든 필수 데이터가 있으면 AuthenticatedState
  if (isAuthenticated && accessToken) {
    return {
      isAuthenticated: true,
      accessToken,
      ...actions,
    };
  }

  // 그 외는 UnauthenticatedState
  return {
    isAuthenticated: false,
    accessToken: null,
    ...actions,
  };
};
