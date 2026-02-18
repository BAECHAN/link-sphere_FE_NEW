import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { Post } from '@/domains/post/_common/model/post.schema';

const rootKey = ['post'] as const;

export const postKeys = {
  root: rootKey,
  listRoot: [...rootKey, 'list'] as const,
  list: (filters?: { search?: string; category?: string; filter?: string }) =>
    [...rootKey, 'list', filters] as const,
  detail: (postId: Post['id']) => [...rootKey, 'detail', postId] as const,
};

export const postInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: () => {
    queryClient.invalidateQueries({ queryKey: postKeys.listRoot });
  },
  detail: (postId: Post['id']) => {
    queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
  },
};

export const handlePostCreateSuccess = () => {
  postInvalidateQueries.list();
};

export const handlePostUpdateSuccess = (postId: Post['id']) => {
  postInvalidateQueries.detail(postId);
  postInvalidateQueries.list();
};
