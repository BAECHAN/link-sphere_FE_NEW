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
  // 댓글 목록은 mutation의 onMutate/onSuccess가 낙관적으로 직접 갱신하므로 여기서 다시
  // invalidate하지 않는다 - 그러면 방금 그려진 결과를 지우고 GET을 한 번 더 태우게 된다.
  // commentCount가 걸린 게시글 상세/목록만 갱신한다.
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
