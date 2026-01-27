import { queryClient } from '@/shared/lib/react-query/config/queryClient';

const rootKey = ['members'] as const;

export const postKeys = {
  root: rootKey,
  listRoot: [...rootKey, 'list'] as const,
  list: () => [...rootKey, 'list'] as const,
  detail: (id: number | undefined) => [...rootKey, 'detail', id] as const,
};

export const postInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: () => {
    // 검색 조건과 관계없이 모든 목록 쿼리 무효화
    queryClient.invalidateQueries({ queryKey: postKeys.listRoot });
  },
  detail: (id: number | undefined) => {
    if (id) {
      queryClient.invalidateQueries({ queryKey: postKeys.detail(id) });
    }
  },
};

export const handlePostCreateSuccess = (id: number) => {
  postInvalidateQueries.detail(id);
  postInvalidateQueries.list();
};
