import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '@/entities/account/api/account.api';
import {
  accountMutationKeys,
  accountKeys,
  handleAccountUpdateSuccess,
} from '@/entities/account/api/account.keys';
import { useAuthStore } from '@/shared/store/auth.store';
import {
  ApiError,
  ImageUploadError,
  NetworkError,
  UserFacingError,
} from '@/shared/types/common.type';
import { Account, UpdateAccount, DeleteAccount } from '@/entities/account/model/account.schema';
import { STALE_TIME_ONE_DAY } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { AuthUtil } from '@/shared/utils/auth.util';
import { ErrorUtil } from '@/shared/utils/error.util';

interface UpdateAccountPayload extends UpdateAccount {
  file?: File;
  /** 낙관적 반영용 blob 미리보기 URL(실패 시엔 폼이 미리보기로 계속 쓴다). BE에는 전송하지 않는다 */
  previewUrl?: string;
}

// 닉네임 중복(409)은 전용 메시지. 그 외 서버발 ApiError는 상세를 노출하지 않고 일반
// 메시지로 감춘다(보안·UX 정책, queryClient.ts의 전역 핸들러와 동일). 이 mutation 안에서
// 우리가 직접 던진 UserFacingError(이미지 용량 초과 등)는 이미 TEXTS.*로 작성한 사용자용
// 메시지이므로 뭉개지 않고 그대로 보여준다 - 안 그러면 원인이 뭐든 "프로필 업데이트에
// 실패했습니다"로만 보여 사용자가 무엇이 문제인지 알 수 없다. 사진 업로드 단계 실패
// (ImageUploadError)·요청 한도(429)·연결 끊김(NetworkError)도 같은 이유로 원인별로 안내한다
// (댓글 폼과 같은 문구, docs/COMMENT.md "이미지 업로드 실패 안내"). 그 외 일반 Error는 여전히
// 일반 메시지로 감싼다 - 브라우저의 날것 기술 에러 문구를 그대로 노출하지 않는다.
function resolveAccountUpdateErrorMessage(error: unknown): string {
  if (error instanceof ImageUploadError) {
    return (
      ErrorUtil.resolveImageUploadMessage(error, 'save') ?? TEXTS.messages.error.accountUpdateFailed
    );
  }
  if (error instanceof NetworkError) {
    return TEXTS.messages.error.uploadSubmit.save.network;
  }
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return TEXTS.messages.error.nicknameDuplicate;
    }
    if (error.status === 429) {
      return TEXTS.messages.error.rateLimited;
    }
    return TEXTS.messages.error.accountUpdateFailed;
  }
  if (error instanceof UserFacingError) {
    return error.message;
  }
  return TEXTS.messages.error.accountUpdateFailed;
}

export const useFetchAccountQuery = (options?: { enabled?: boolean }) => {
  // 비로그인 상태에선 계정 조회를 하지 않는다 (401 → 전역 로그인 리다이렉트 방지)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: accountKeys.root,
    queryFn: () => accountApi.fetchAccount(),
    enabled: isAuthenticated && options?.enabled !== false,
    staleTime: STALE_TIME_ONE_DAY,
    meta: {
      errorMessage: TEXTS.messages.error.fetchAccount,
    },
  });
};

export const useUpdateAccountMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: accountMutationKeys.update,
    mutationFn: (payload: UpdateAccountPayload) =>
      accountApi.updateAccount({
        nickname: payload.nickname,
        image: payload.image,
        file: payload.file,
      }),
    meta: { manualErrorHandling: true, successMessage: TEXTS.messages.success.accountUpdated },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: accountKeys.root });
      const previous = queryClient.getQueryData<Account>(accountKeys.root);
      if (previous) {
        queryClient.setQueryData<Account>(accountKeys.root, {
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
      queryClient.setQueryData<Account>(accountKeys.root, data);
      handleAccountUpdateSuccess(queryClient);
      if (variables.previewUrl) {
        URL.revokeObjectURL(variables.previewUrl);
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(accountKeys.root, context.previous);
      }
      const message = resolveAccountUpdateErrorMessage(error);

      // previewUrl은 여기서 해제하지 않는다 - useUpdateAccount.ts의 onSubmit이 실패 시
      // 아무것도 건드리지 않아 화면에 미리보기로 계속 쓰이므로, 성공 시에만 정리한다.
      toast.error(message, { id: 'profile-update-error' });
    },
  });
};

// 성공하면 BE가 이 기기의 세션·쿠키를 이미 폐기했으므로, useLogoutMutation과 달리 API
// 응답을 기다린 뒤 clearAll을 호출한다(로그아웃은 클라이언트가 먼저 지우고 API는
// best-effort지만, 탈퇴는 서버 처리 성공을 확인한 뒤에만 "탈퇴 신청됨"으로 취급해야 한다 -
// 비밀번호가 틀려 실패했는데 클라이언트만 먼저 로그아웃 상태로 만들면 안 된다).
export const useDeleteAccountMutation = () => {
  return useMutation({
    mutationFn: (payload: DeleteAccount) => accountApi.deleteAccount(payload),
    meta: { manualErrorHandling: true },
    onSuccess: () => {
      toast.success(TEXTS.messages.success.accountDeleted);
      AuthUtil.clearAll();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === SERVER_ERROR_CODE.INVALID_CREDENTIALS) {
        toast.error(TEXTS.messages.error.currentPasswordMismatch);
      } else {
        toast.error(TEXTS.messages.error.accountDeleteFailed);
      }
    },
  });
};
