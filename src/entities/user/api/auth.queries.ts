import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '@/entities/user/api/auth.api';
import { handleAccountUpdateSuccess } from '@/entities/user/api/auth.keys';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { useAuthStore } from '@/shared/store/auth.store';
import { ApiError } from '@/shared/types/common.type';
import { Account, Login, CreateAccount, UpdateAccount } from '@/shared/types/auth.type';
import { AuthUtil } from '@/shared/utils/auth.util';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
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
    meta: { manualErrorHandling: true },
    onSuccess: (data) => {
      // 1. 새 토큰 저장 (인증 상태 전환)
      setAuth(data.accessToken);
      // 2. 캐시를 clear()하지 않고 invalidate만 한다. 인라인 모달 로그인은 페이지 이동
      //    없이 제자리에서 일어나므로, clear()로 캐시를 비우면 마운트된 화면(댓글 목록 등)의
      //    옵저버가 깨져 이후 갱신이 화면에 반영되지 않는다. invalidate는 옵저버를 유지한 채
      //    새 인증 상태로 다시 불러온다(내 좋아요/북마크/계정 등).
      void queryClient.invalidateQueries();
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

    // 2. auth 상태 즉시 초기화. 현재 화면이 보호 페이지면 공개 피드로 이동하고,
    //    비로그인도 볼 수 있는 페이지면 그대로 머문다(이동 없음).
    if (isProtectedPath(window.location.pathname)) {
      AuthUtil.clearAll(ROUTES_PATHS.POST.ROOT);
    } else {
      AuthUtil.clearAuth();
      AuthUtil.clearQueries();
    }

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
  // 비로그인 상태에선 계정 조회를 하지 않는다 (401 → 전역 로그인 리다이렉트 방지)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: authKeys.account(),
    queryFn: () => authApi.fetchAccount(),
    enabled: isAuthenticated && options?.enabled !== false,
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
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: authKeys.account() });
      const previous = queryClient.getQueryData<Account>(authKeys.account());
      if (previous) {
        queryClient.setQueryData<Account>(authKeys.account(), {
          ...previous,
          nickname: payload.nickname,
          image: payload.image ?? undefined,
        });
      }
      return { previous };
    },
    onSuccess: () => {
      handleAccountUpdateSuccess();
      toast.success(TEXTS.messages.success.accountUpdated);
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(authKeys.account(), context.previous);
      }
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
