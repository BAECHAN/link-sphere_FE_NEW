import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { Post } from '@/domains/post/_common/model/post.schema';

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

export const handleCommentMutateSuccess = (postId: Post['id']) => {
  commentInvalidateQueries.list(postId);
};
