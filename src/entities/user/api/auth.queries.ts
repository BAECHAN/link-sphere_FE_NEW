import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from '@/entities/user/api/auth.api';
import { authMutationKeys, handleAccountUpdateSuccess } from '@/entities/user/api/auth.keys';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { useAuthStore } from '@/shared/store/auth.store';
import { useMyPageModalStore } from '@/shared/store/mypage.store';
import { ApiError, UserFacingError } from '@/shared/types/common.type';
import { Account, Login, CreateAccount, UpdateAccount } from '@/shared/types/auth.type';
import { AuthUtil } from '@/shared/utils/auth.util';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
import { STALE_TIME_ONE_DAY } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { API_ENDPOINTS } from '@/shared/config/api';
import { useNavigate } from 'react-router-dom';
import { requestAndRegisterFcmToken, unregisterFcmToken } from '@/shared/lib/firebase/fcm';

interface UpdateAccountPayload extends UpdateAccount {
  file?: File;
  /** 낙관적 반영·실패 시 모달 재오픈용 blob 미리보기 URL. BE에는 전송하지 않는다 */
  previewUrl?: string;
}

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
    mutationKey: authMutationKeys.updateAccount,
    mutationFn: (payload: UpdateAccountPayload) =>
      authApi.updateAccount({
        nickname: payload.nickname,
        image: payload.image,
        file: payload.file,
      }),
    meta: { manualErrorHandling: true },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: authKeys.account() });
      const previous = queryClient.getQueryData<Account>(authKeys.account());
      if (previous) {
        queryClient.setQueryData<Account>(authKeys.account(), {
          ...previous,
          nickname: payload.nickname,
          // 새 파일을 고른 경우 업로드가 끝나기 전까지 blob 미리보기를 먼저 보여준다
          image: payload.previewUrl ?? payload.image ?? undefined,
        });
      }
      return { previous };
    },
    onSuccess: (data, variables) => {
      // 서버 응답(실제 업로드 URL 등)으로 캐시를 치환한다 - invalidate 재조회 없이 바로 반영
      queryClient.setQueryData<Account>(authKeys.account(), data);
      handleAccountUpdateSuccess();
      if (variables.previewUrl) {
        URL.revokeObjectURL(variables.previewUrl);
      }
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(authKeys.account(), context.previous);
      }
      // 닉네임 중복(409)은 전용 메시지. 그 외 서버발 ApiError는 상세를 노출하지 않고 일반
      // 메시지로 감춘다(보안·UX 정책, queryClient.ts의 전역 핸들러와 동일). 이 mutation 안에서
      // 우리가 직접 던진 UserFacingError(이미지 용량 초과·스토리지 업로드 실패 등)는 이미
      // TEXTS.*로 작성한 사용자용 메시지이므로 뭉개지 않고 그대로 보여준다 - 안 그러면 원인이
      // 뭐든 "프로필 업데이트에 실패했습니다"로만 보여 사용자가 무엇이 문제인지 알 수 없다.
      // 네트워크 실패 등 그 외 일반 Error는 UserFacingError가 아니므로 여전히 일반 메시지로
      // 감싼다 - 브라우저의 날것 기술 에러 문구(예: "Failed to fetch")를 그대로 노출하지 않는다.
      let message: string;
      if (error instanceof ApiError) {
        message =
          error.status === 409
            ? TEXTS.messages.error.nicknameDuplicate
            : TEXTS.messages.error.accountUpdateFailed;
      } else if (error instanceof UserFacingError) {
        message = error.message;
      } else {
        message = TEXTS.messages.error.accountUpdateFailed;
      }

      // 모달은 이미 닫힌 뒤라 실패를 놓치기 쉽다 - 자동으로 사라지지 않게 하고, "다시 열기"로
      // 시도했던 값(파일 포함) 그대로 모달을 복원한다. previewUrl은 여기서 해제하지 않는다 -
      // 재오픈 시 미리보기로 다시 쓰이므로, 성공 시에만 정리한다.
      toast.error(message, {
        id: 'profile-update-error',
        duration: Infinity,
        action: {
          label: TEXTS.mypage.reopen,
          onClick: () =>
            useMyPageModalStore.getState().openWith({
              nickname: variables.nickname,
              imagePreview: variables.previewUrl ?? variables.image ?? null,
              pendingFile: variables.file ?? null,
            }),
        },
      });
    },
  });
};
