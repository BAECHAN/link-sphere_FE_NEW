import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/domains/auth/_common/api/auth.api';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { LoginRequest } from '@/domains/auth/_common/model/auth.schema';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

export const authKeys = {
  root: ['auth'] as const,
  login: () => [...authKeys.root, 'login'] as const,
  logout: () => [...authKeys.root, 'logout'] as const,
  refreshToken: () => [...authKeys.root, 'refresh-token'] as const,
};

export const useLoginMutation = () => {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (data) => {
      // 1. 기존 캐시 초기화
      queryClient.clear();
      // 2. 인메모리 스토어에 토큰 및 유저 정보 저장
      setAuth(data.accessToken, data.user.role, data.user);
    },
  });
};

export const useLogoutMutation = () => {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const mutation = useMutation({
    mutationFn: () => authApi.logout(),
    meta: {
      ignoreError: true,
    },
  });

  // 서버 응답을 기다리는 래퍼 함수
  const logout = async () => {
    try {
      // 1. 진행 중인 모든 쿼리 취소 및 캐시 초기화 (데이터 유출 방지)
      queryClient.cancelQueries();
      queryClient.clear();

      // 2. 서버 요청 전송 (에러가 나더라도 무시하고 클라이언트 정리는 진행)
      await mutation.mutateAsync();
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // 3. 로컬 스토리지 및 전역 상태 초기화
      LocalStorageUtil.removeItem('refreshToken');
      clearAuth();

      // 4. ProtectedRoute가 isAuthenticated를 감지하여 자동으로 /login으로 보냅니다.
      // 만약 자동으로 이동하지 않는 환경이라면 아래와 같이 navigate를 쓸 수 있습니다.
      // navigate(ROUTES_PATHS.AUTH.LOGIN, { replace: true });
    }
  };

  return {
    ...mutation,
    mutate: logout, // 래핑된 함수를 mutate로 노출
  };
};
