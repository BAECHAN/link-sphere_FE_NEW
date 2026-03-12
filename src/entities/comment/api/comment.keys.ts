import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { Post } from '@/entities/post/model/post.schema';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';

const rootKey = ['comments'] as const;

export const commentKeys = {
  root: rootKey,
  list: (postId: Post['id']) => [...rootKey, postId] as const,
};

export const commentInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: (postId: Post['id']) => {
    queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
  },
};

export const handleCommentCreateSuccess = (postId: Post['id']) => {
  commentInvalidateQueries.list(postId);
  postInvalidateQueries.detail(postId);
  postInvalidateQueries.list();
};

export const handleCommentDeleteSuccess = (postId: Post['id']) => {
  commentInvalidateQueries.list(postId);
  postInvalidateQueries.detail(postId);
  postInvalidateQueries.list();
};

export const handleCommentUpdateSuccess = (postId: Post['id']) => {
  commentInvalidateQueries.list(postId);
};

export const handleCommentMutateSuccess = (postId: Post['id']) => {
  commentInvalidateQueries.list(postId);
};
