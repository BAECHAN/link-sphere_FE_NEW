import { useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import { authApi } from '@/entities/auth/api/auth.api';
import { useAuthStore } from '@/shared/store/auth.store';
import { ApiError } from '@/shared/types/common.type';
import {
  Login,
  CreateAccount,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePassword,
  EmailVerificationRequest,
  EmailVerificationConfirm,
} from '@/entities/auth/model/auth.schema';
import { AuthUtil } from '@/shared/utils/auth.util';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { useNavigate } from 'react-router-dom';
import { requestAndRegisterFcmToken, unregisterFcmToken } from '@/shared/lib/firebase/fcm';
import { handleEmailVerificationConfirmSuccess } from '@/entities/auth/api/auth.keys';

function isErroredCacheWithoutData(query: Query): boolean {
  return query.state.status === 'error' && query.state.data === undefined;
}

export const useLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Login) => authApi.login(payload),
    meta: { manualErrorHandling: true },
    onSuccess: (data) => {
      // 1. 새 토큰 저장 (인증 상태 전환)
      setAuth(data.accessToken);
      // 2. 로그아웃이 남긴 에러 캐시만 초기화한다. clearQueries()의 resetQueries()가 토큰을
      //    지운 직후 화면에 남아있던 쿼리를 배경 재요청시켜 401로 error 상태를 만드는데,
      //    Suspense 쿼리는 캐시가 error면 재마운트해도 retryOnMount=false로 막혀 새 요청을
      //    아예 내지 않고 옛 에러를 그대로 다시 throw한다(query-core queryObserver의
      //    shouldLoadOnMount). 아래 3의 invalidate는 활성 쿼리만 다시 부르므로 이미 언마운트된
      //    이런 쿼리에는 닿지 못한다. data를 들고 있는 쿼리(재요청만 실패한 경우)는 화면이
      //    멀쩡하고 재마운트 시 정상 재요청되므로 건드리지 않는다 - 지우면 오히려 깜빡인다.
      //    3보다 먼저 둔다: resetQueries의 내부 재조회는 리셋 뒤 predicate가 더 이상
      //    매칭되지 않아 아무것도 다시 부르지 않으므로, 활성 쿼리의 재요청은 3이 맡는다.
      void queryClient.resetQueries({
        predicate: isErroredCacheWithoutData,
      });
      // 3. 캐시를 clear()하지 않고 invalidate만 한다. 인라인 모달 로그인은 페이지 이동
      //    없이 제자리에서 일어나므로, clear()로 캐시를 비우면 마운트된 화면(댓글 목록 등)의
      //    옵저버가 깨져 이후 갱신이 화면에 반영되지 않는다. invalidate는 옵저버를 유지한 채
      //    새 인증 상태로 다시 불러온다(내 좋아요/북마크/계정 등).
      void queryClient.invalidateQueries();
      // 4. FCM 토큰 등록 (브라우저 알림 권한 요청 + 서버 등록)
      void requestAndRegisterFcmToken();
    },
    onError: (error) => {
      console.log(error);
      if (error instanceof ApiError) {
        if (error.status === 401) {
          // 서버 원문 메시지(error.data.message)는 노출하지 않는다 - error.util.ts의
          // "날것의 error.message를 노출하지 않는다" 정책과 동일한 규칙(보안·UX).
          toast.error(TEXTS.messages.error.loginFailedPasswordMismatch);
        } else {
          toast.error(TEXTS.messages.error.loginFailed);
        }
      } else {
        // ApiError가 아닌 경우(오프라인·CORS·DNS 실패 등 네트워크 자체 실패)도 반드시 토스트를
        // 띄운다 - useCreateAccountMutation과 동일한 이유(이 분기가 없으면 버튼만 다시
        // 활성화되고 아무 안내 없이 조용히 실패한다).
        toast.error(TEXTS.messages.error.loginFailed);
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

// 가입 성공 후 화면 전환("메일함을 확인해주세요" 상태)은 useSignUp.ts가 로컬 상태로
// 처리한다 - BE가 가입 시 인증메일을 자동 발송하므로(AuthService.signup) 여기서
// navigate도, 성공 토스트도 필요 없다(화면 자체가 성공을 보여준다, 가시성 원칙).
export const useCreateAccountMutation = () => {
  return useMutation({
    mutationFn: async (payload: CreateAccount) => {
      return await authApi.createAccount(payload);
    },
    meta: {
      manualErrorHandling: true,
    },
    onError: (error) => {
      // ApiError가 아닌 경우(오프라인·CORS·DNS 실패 등 네트워크 자체 실패)도 반드시 토스트를
      // 띄운다 - 이 분기가 없으면 버튼만 다시 활성화되고 아무 안내 없이 조용히 실패한다.
      if (error instanceof ApiError) {
        if (error.code === SERVER_ERROR_CODE.DUPLICATE_NICKNAME) {
          toast.error(TEXTS.messages.error.nicknameDuplicate);
        } else if (error.status === 409) {
          toast.error(TEXTS.messages.error.accountCreateFailedDuplicateAccount);
        } else {
          toast.error(TEXTS.messages.error.accountCreateFailed);
        }
      } else {
        toast.error(TEXTS.messages.error.accountCreateFailed);
      }
    },
  });
};

// 계정 존재 여부와 무관하게 서버가 항상 200을 반환한다(이메일 열람 여부 노출 방지) - 성공
// 여부는 폼이 "메일함을 확인해주세요" 상태로 전환하는 것으로 보여준다(가시성 원칙, 토스트
// 불필요). 여기서 잡는 에러는 네트워크·429·500 등 그 자체가 실패한 경우뿐이다.
export const useRequestPasswordResetMutation = () => {
  return useMutation({
    mutationFn: async (payload: PasswordResetRequest) => {
      return await authApi.requestPasswordReset(payload);
    },
    meta: { manualErrorHandling: true },
    onError: () => {
      // ApiError든 네트워크 자체 실패든 항상 같은 메시지 - 이 콜백이 없으면 버튼만
      // 다시 활성화되고 아무 안내 없이 조용히 실패한다.
      toast.error(TEXTS.messages.error.passwordResetRequestFailed);
    },
  });
};

export const useConfirmPasswordResetMutation = () => {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (payload: PasswordResetConfirm) => {
      return await authApi.confirmPasswordReset(payload);
    },
    meta: {
      successMessage: TEXTS.messages.success.passwordResetConfirmed,
      manualErrorHandling: true,
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === SERVER_ERROR_CODE.INVALID_ACTION_TOKEN) {
          toast.error(TEXTS.messages.error.passwordResetTokenInvalid);
        } else {
          toast.error(TEXTS.messages.error.passwordResetConfirmFailed);
        }
      } else {
        toast.error(TEXTS.messages.error.passwordResetConfirmFailed);
      }
    },
    onSuccess: () => {
      navigate(ROUTES_PATHS.AUTH.LOGIN);
    },
  });
};

// 성공하면 다른 기기는 전부 로그아웃되고 이 기기만 새 세션을 받는다(auth.api.ts의
// changePassword 참고) - onSuccess에서 그 새 토큰으로 즉시 갱신해야 다음 요청이 401나지 않는다.
export const useChangePasswordMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (payload: ChangePassword) => authApi.changePassword(payload),
    meta: { manualErrorHandling: true, successMessage: TEXTS.messages.success.passwordChanged },
    onSuccess: (data) => {
      setAuth(data.accessToken);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === SERVER_ERROR_CODE.INVALID_CREDENTIALS) {
        // useLoginMutation의 401 처리와 같은 이유로 서버 원문 메시지는 노출하지 않는다.
        toast.error(TEXTS.messages.error.currentPasswordMismatch);
      } else {
        toast.error(TEXTS.messages.error.passwordChangeFailed);
      }
    },
  });
};

// 계정 존재·인증 여부와 무관하게 서버가 항상 200을 반환한다(useRequestPasswordResetMutation과
// 같은 이유) - MyAccountPage의 "재발송" 버튼 전용이라, 클릭에 대한 눈에 보이는 화면 변화가
// 없으므로(가시성 원칙) 토스트로 결과를 알린다.
export const useRequestEmailVerificationMutation = () => {
  return useMutation({
    mutationFn: async (payload: EmailVerificationRequest) => {
      return await authApi.requestEmailVerification(payload);
    },
    meta: {
      successMessage: TEXTS.messages.success.emailVerificationResent,
      manualErrorHandling: true,
    },
    onError: () => {
      toast.error(TEXTS.messages.error.emailVerificationRequestFailed);
    },
  });
};

// VerifyEmailPage가 mount 시 token으로 호출한다 - 성공 여부를 페이지 자체가 상태로
// 보여주므로(가시성 원칙) 토스트는 없다. 계정 캐시 무효화만 훅 레벨에서 소유한다
// (React Query 라이프사이클 표 - useMutation({onSuccess})는 언마운트 후에도 실행).
export const useConfirmEmailVerificationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: EmailVerificationConfirm) => {
      return await authApi.confirmEmailVerification(payload);
    },
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      handleEmailVerificationConfirmSuccess(queryClient);
    },
  });
};
