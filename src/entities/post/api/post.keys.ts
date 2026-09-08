import type { QueryClient } from '@tanstack/react-query';
import { Post } from '@/entities/post/model/post.schema';

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
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: postKeys.listRoot });
  },
  detail: (queryClient: QueryClient, postId: Post['id']) => {
    queryClient.invalidateQueries({ queryKey: postKeys.detail(postId) });
  },
};

export const handlePostCreateSuccess = (queryClient: QueryClient) => {
  postInvalidateQueries.list(queryClient);
};

export const handlePostUpdateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};
