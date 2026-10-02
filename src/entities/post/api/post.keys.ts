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

/**
 * 무효화(재조회)가 아니라 캐시에서 아예 지워야 할 때 — 삭제된 글의 상세처럼 다시 받아올
 * 대상이 없는 경우. 남겨 두면 뒤로가기로 돌아왔을 때 staleTime 안에서 삭제된 글이 그대로 그려진다.
 */
export const postRemoveQueries = {
  detail: (queryClient: QueryClient, postId: Post['id']) => {
    queryClient.removeQueries({ queryKey: postKeys.detail(postId), exact: true });
  },
};

export const handlePostCreateSuccess = (queryClient: QueryClient) => {
  postInvalidateQueries.list(queryClient);
};

export const handlePostUpdateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};
