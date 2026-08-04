import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';

export const authKeys = {
  root: () => ['auth'] as const,
  account: () => [...authKeys.root(), 'account'] as const,
};

export const authMutationKeys = {
  updateAccount: [...authKeys.root(), 'updateAccount'] as const,
};

export const authInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: authKeys.root() });
  },
};

/**
 * 프로필(닉네임·이미지) 변경 시 포스트 목록만 갱신한다 - account는 mutation의
 * onMutate/onSuccess가 낙관적으로 캐시를 직접 쓰므로 여기서 다시 invalidate하지 않는다
 * (handleCommentCreateSuccess와 동일한 이유: 이미 쓴 값을 지우고 GET을 한 번 더 태우게 된다).
 */
export const handleAccountUpdateSuccess = () => {
  postInvalidateQueries.list();
};

/**
 * 세션 복원(refresh) 성공 시 포스트 목록 재검증.
 * 복원 전에 비로그인 상태로 이미 나간 공개 목록 요청이 있을 수 있으므로,
 * 복원된 인증 상태로 다시 가져오도록 무효화한다.
 */
export const handleAuthRestoreSuccess = () => {
  postInvalidateQueries.list();
};
