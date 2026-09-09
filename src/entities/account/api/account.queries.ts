import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '@/entities/account/api/account.api';
import {
  accountMutationKeys,
  accountKeys,
  handleAccountUpdateSuccess,
} from '@/entities/account/api/account.keys';
import { useAuthStore } from '@/shared/store/auth.store';
import { useMyPageModalStore } from '@/shared/store/mypage.store';
import { ApiError, UserFacingError } from '@/shared/types/common.type';
import { Account, UpdateAccount } from '@/entities/account/model/account.schema';
import { STALE_TIME_ONE_DAY } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { NavigationService } from '@/shared/lib/router/navigation';

interface UpdateAccountPayload extends UpdateAccount {
  file?: File;
  /** 낙관적 반영·실패 시 모달 재오픈용 blob 미리보기 URL. BE에는 전송하지 않는다 */
  previewUrl?: string;
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
    meta: { manualErrorHandling: true },
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
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(accountKeys.root, context.previous);
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
      // 이 콜백은 React 트리 밖(토스트 라이브러리의 DOM 클릭 핸들러)에서 실행되어 훅을 쓸 수
      // 없으므로, 모달 열림은 NavigationService로 현재 위치에 히스토리 엔트리를 직접 push한다.
      toast.error(message, {
        id: 'profile-update-error',
        duration: Infinity,
        action: {
          label: TEXTS.mypage.reopen,
          onClick: () => {
            // eslint-disable-next-line no-restricted-syntax -- 위 주석대로 React 트리 밖이라 Selector 패턴을 쓸 훅 컨텍스트 자체가 없다
            useMyPageModalStore.getState().setRestoreValues({
              nickname: variables.nickname,
              imagePreview: variables.previewUrl ?? variables.image ?? null,
              pendingFile: variables.file ?? null,
            });
            NavigationService.navigate(`${window.location.pathname}${window.location.search}`, {
              state: { myPageOpen: true },
              preventScrollReset: true,
            });
          },
        },
      });
    },
  });
};
