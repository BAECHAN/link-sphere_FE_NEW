import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '@/domains/auth/_common/api/auth.api';
import { useAuthStore } from '@/shared/store/auth.store';
import { ApiError } from '@/shared/types/common.type';
import { Login, CreateAccount } from '@/shared/types/auth.type';
import { AuthUtil } from '@/shared/utils/auth.util';
import { STALE_TIME_ONE_DAY } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { toast } from 'sonner';
import { API_ENDPOINTS } from '@/shared/config/api';
import { useNavigate } from 'react-router-dom';
import { requestAndRegisterFcmToken, unregisterFcmToken } from '@/shared/lib/firebase/fcm';

export const authKeys = {
  root: ['auth'] as const,
  login: () => [...authKeys.root, 'login'] as const,
  logout: () => [...authKeys.root, 'logout'] as const,
  account: () => [...authKeys.root, 'account'] as const,
};

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: Login) => authApi.login(payload),
    onSuccess: (data) => {
      // 1. 기존 캐시 초기화
      AuthUtil.clearAll();
      // 2. 인메모리 스토어에 토큰 및 유저 정보 저장
      setAuth(data.accessToken);
      // 3. FCM 토큰 등록 (브라우저 알림 권한 요청 + 서버 등록)
      void requestAndRegisterFcmToken();
    },
    onError: (error) => {
      console.log(error);
      if (error instanceof ApiError) {
        if (error.status === 401) {
          const errorMessage = error.data.message;
          toast.error(errorMessage);
        }
      }
    },
  });
};

export const useLogoutMutation = () => {
  const mutation = useMutation({
    mutationFn: () => authApi.logout(),
    meta: {
      ignoreError: true,
    },
  });

  // 서버 응답을 기다리는 래퍼 함수
  const logout = async () => {
    try {
      // 2. 서버 요청 전송 (에러가 나더라도 무시하고 클라이언트 정리는 진행)
      await mutation.mutateAsync();
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // FCM 토큰 삭제 (로그아웃 시 기기 토큰 해제)
      await unregisterFcmToken();
      AuthUtil.clearAll();
    }
  };

  return {
    ...mutation,
    mutate: logout, // 래핑된 함수를 mutate로 노출
  };
};

export const useFetchAccountQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: authKeys.account(),
    queryFn: () => authApi.fetchAccount(),
    enabled: options?.enabled !== false,
    staleTime: STALE_TIME_ONE_DAY,
    meta: {
      errorMessage: TEXTS.messages.error.fetchAccount,
    },
  });
};

export const useCreateAccountMutation = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (payload: CreateAccount) => {
      return await authApi.createAccount(payload);
    },
    meta: {
      successMessage: TEXTS.messages.success.accountCreated,
      manualErrorHandling: true,
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          toast.error(TEXTS.messages.error.accountCreateFailedDuplicateAccount);
        } else {
          toast.error(TEXTS.messages.error.accountCreateFailed);
        }
      }
    },
    onSuccess: () => {
      navigate(API_ENDPOINTS.auth.login);
    },
  });
};
