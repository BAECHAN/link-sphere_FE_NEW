import type { QueryClient } from '@tanstack/react-query';
import { Post } from '@/entities/post/model/post.schema';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';

const rootKey = ['comments'] as const;

export const commentKeys = {
  root: rootKey,
  list: (postId: Post['id']) => [...rootKey, postId] as const,
};

export const commentInvalidateQueries = {
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: (queryClient: QueryClient, postId: Post['id']) => {
    queryClient.invalidateQueries({ queryKey: commentKeys.list(postId) });
  },
};

export const handleCommentCreateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  // 댓글 목록은 mutation의 onMutate/onSuccess가 낙관적으로 직접 갱신하므로 여기서 다시
  // invalidate하지 않는다 - 그러면 방금 그려진 결과를 지우고 GET을 한 번 더 태우게 된다.
  // commentCount가 걸린 게시글 상세/목록만 갱신한다.
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};

export const handleCommentDeleteSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};

export const handleCommentUpdateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
};

export const handleCommentMutateSuccess = (queryClient: QueryClient, postId: Post['id']) => {
  commentInvalidateQueries.list(queryClient, postId);
};
