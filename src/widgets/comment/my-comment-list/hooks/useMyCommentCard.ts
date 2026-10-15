import { useQueryClient } from '@tanstack/react-query';
import { prefetchPostDetail } from '@/entities/post/api/post.queries';
import { prefetchComments } from '@/entities/comment/api/comment.queries';

/**
 * 내 댓글 카드 hover·focus 때 원글과 그 댓글 목록을 미리 받는다 — 카드를 누르면 항상 원글의
 * 그 댓글(#comment-<id>)로 가서, 댓글 목록이 와야 스크롤할 수 있다. 게시글 카드의 💬 hover와
 * 같은 방식이다(usePostCard.ts의 handlePrefetchDetailWithComments, docs/COMMENT.md "해시 이동").
 */
export const useMyCommentCard = (postId: string) => {
  const queryClient = useQueryClient();

  const handlePrefetchDetailWithComments = () => {
    prefetchPostDetail(queryClient, postId);
    prefetchComments(queryClient, postId);
  };

  return { handlePrefetchDetailWithComments };
};
