import { useLikeCommentMutation } from '@/domains/post/_common/api/interaction.queries';
import { Comment } from '@/domains/post/_common/model/comment.schema';
import { Post } from '@/domains/post/_common/model/post.schema';

export function useLikeComment(commentId: Comment['id'], postId: Post['id']) {
  return useLikeCommentMutation(commentId, postId);
}
