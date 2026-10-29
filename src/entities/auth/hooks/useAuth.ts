import { useCallback } from 'react';
import { useAuthStore } from '@/shared/store/auth.store';
import { useShallow } from 'zustand/react/shallow';
import { authApi } from '@/entities/auth/api/auth.api';
import { useLoginMutation, useLogoutMutation } from '@/entities/auth/api/auth.queries';
import { Login } from '@/entities/auth/model/auth.schema';
import { Account } from '@/entities/account/@x/auth';
import { reregisterFcmTokenIfGranted } from '@/shared/lib/firebase/fcm';
import { ErrorUtil } from '@/shared/utils/error.util';

// ==================== Types ====================

/**
 * 세션 복원 결과 - 'expired'는 BE가 refresh를 401로 거절한 경우(쿠키 없음·만료·폐기), 'failed'는 그 밖의 실패
 * (네트워크·5xx, 응답에 토큰 없음). 둘 다 이 탭을 로그아웃한다 - 앱 시작 때 만료 안내를 띄울지만 갈린다(useAppInitialization)
 */
type AuthRestoreResult = 'restored' | 'expired' | 'failed';

type AuthActions = {
  login: (data: Login) => Promise<void>;
  restoreAuthWithResult: () => Promise<AuthRestoreResult>;
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

  // 토큰 복원 함수 - 실패하면 만료인지 그 밖의 실패인지 함께 돌려준다
  const restoreAuthWithResult = useCallback(async (): Promise<AuthRestoreResult> => {
    try {
      if (accessToken && isAuthenticated) {
        return 'restored';
      }

      const authData = await authApi.refresh();

      if (!authData || !authData.accessToken) {
        clearAuth();
        return 'failed';
      }

      setAuth(authData.accessToken);
      // 앱 부팅 시 세션이 복원되면 이 기기의 FCM 토큰도 새 세션의 회전 계열(familyId)로
      // 재등록한다 - 안 하면 예전에 등록된 적 없는(또는 레거시) 토큰이 다음 발송 때
      // 비활성으로 간주돼 지워진다(fcm.ts 참고). 사용자가 아무것도 누르지 않은 때라 권한은 묻지 않고,
      // 이미 허용한 기기만 재등록한다.
      void reregisterFcmTokenIfGranted();
      return 'restored';
    } catch (error) {
      console.error('Auth restore failed', error);
      clearAuth();
      return ErrorUtil.isRefreshRejected(error) ? 'expired' : 'failed';
    }
  }, [accessToken, isAuthenticated, setAuth, clearAuth]);

  // 공통 액션
  const actions = {
    login,
    restoreAuthWithResult,
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
