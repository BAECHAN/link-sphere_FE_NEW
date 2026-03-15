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
