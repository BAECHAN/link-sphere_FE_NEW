import { useCallback } from 'react';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { useShallow } from 'zustand/react/shallow';
import { authApi } from '@/domains/auth/_common/api/auth.api';
import { useLoginMutation, useLogoutMutation } from '@/domains/auth/_common/api/auth.queries';
import { MemberRole } from '@/domains/member/_common/model/member.schema';
import { LoginRequest } from '@/domains/auth/_common/model/auth.schema';
import { isMemberRole } from '@/domains/member/_common/util/member.util';

// ==================== Types ====================

type AuthActions = {
  login: (data: LoginRequest) => Promise<void>;
  restoreAuth: () => Promise<boolean>;
  logout: () => void;
  setAuth: (accessToken: string | null, role: MemberRole | null) => void;
};

type AuthState = {
  isAuthenticated: boolean;
  accessToken: string | null;
  role: MemberRole | null;
  user: any;
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
  const { accessToken, setAuth, clearAuth, isAuthenticated, role, user } = useAuthStore(
    useShallow((state) => ({
      accessToken: state.accessToken,
      setAuth: state.setAuth,
      clearAuth: state.clearAuth,
      isAuthenticated: state.isAuthenticated,
      role: state.role,
      user: state.user,
    }))
  );

  const { mutate: logout } = useLogoutMutation();
  const { mutateAsync: loginMutation, isPending: isLoginPending } = useLoginMutation();

  // 로그인 처리 함수
  const login = useCallback(
    async (data: LoginRequest) => {
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

      if (!isMemberRole(authData.user.role)) {
        throw new Error('Invalid role');
      }

      setAuth(authData.accessToken, authData.user.role, authData.user);
      return true;
    } catch (error) {
      console.error('Auth restore failed', error);
      clearAuth();
      return false;
    }
  }, [accessToken, isAuthenticated, setAuth, clearAuth]);

  return {
    isAuthenticated,
    accessToken,
    role,
    user,
    login,
    restoreAuth,
    logout,
    setAuth,
    isLoginPending,
  };
};
