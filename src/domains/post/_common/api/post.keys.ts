import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { Post } from '@/domains/post/_common/model/post.schema';

const rootKey = ['post'] as const;

export const postMutationKeys = {
  create: [...rootKey, 'create'] as const,
  update: (postId: string) => [...rootKey, 'update', postId] as const,
  delete: [...rootKey, 'delete'] as const,
  updateVisibility: (postId: string) => [...rootKey, 'updateVisibility', postId] as const,
};

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
  queryClient.resetQueries({ queryKey: postKeys.listRoot });
};

export const handlePostUpdateSuccess = (postId: Post['id']) => {
  postInvalidateQueries.detail(postId);
  postInvalidateQueries.list();
};
