import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '@/entities/user/api/auth.api';
import { handleAccountUpdateSuccess } from '@/entities/user/api/auth.keys';
import { useAuthStore } from '@/shared/store/auth.store';
import { ApiError } from '@/shared/types/common.type';
import { Login, CreateAccount, UpdateAccount } from '@/shared/types/auth.type';
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
  const logout = () => {
    // 1. API 요청 먼저 시작 (토큰이 아직 스토어에 있으므로 Authorization 헤더 포함됨)
    authApi.logout().catch((error) => {
      console.error('[LOGOUT] Error logging out:', error);
    });

    // 2. auth 상태 즉시 초기화 → ProtectedRoute가 즉시 로그인 페이지로 redirect
    AuthUtil.clearAll();

    // 3. FCM 토큰 해제는 백그라운드로 처리
    unregisterFcmToken().catch((error) => {
      console.error('[LOGOUT] Error unregistering FCM token:', error);
    });
  };

  return {
    mutate: logout,
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

export const useUpdateAccountMutation = () => {
  return useMutation({
    mutationFn: (payload: UpdateAccount) => authApi.updateAccount(payload),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleAccountUpdateSuccess();
      toast.success(TEXTS.messages.success.accountUpdated);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(TEXTS.messages.error.nicknameDuplicate);
      } else {
        toast.error(TEXTS.messages.error.accountUpdateFailed);
      }
    },
  });
};

export const useUploadAvatarMutation = () => {
  return useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    meta: { manualErrorHandling: true },
    onError: () => {
      toast.error(TEXTS.messages.error.avatarUploadFailed);
    },
  });
};
