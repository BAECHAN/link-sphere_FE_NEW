import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';

export const authKeys = {
  root: () => ['auth'] as const,
  account: () => [...authKeys.root(), 'account'] as const,
};

export const authInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: authKeys.root() });
  },
  account: () => {
    queryClient.invalidateQueries({ queryKey: authKeys.account() });
  },
};

/** 프로필(닉네임·이미지) 변경 시 account + 포스트 목록 동시 갱신 */
export const handleAccountUpdateSuccess = () => {
  authInvalidateQueries.account();
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
