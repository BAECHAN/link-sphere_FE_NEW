import { useComments } from '@/domains/post/_common/api/comment.queries';

interface UseCommentListOptions {
  postId: string;
}

export function useCommentList({ postId }: UseCommentListOptions) {
  const { data: comments, isLoading, error } = useComments(postId);

  return {
    comments: comments ?? [],
    isLoading,
    error,
    isEmpty: !isLoading && !error && (!comments || comments.length === 0),
  };
}
