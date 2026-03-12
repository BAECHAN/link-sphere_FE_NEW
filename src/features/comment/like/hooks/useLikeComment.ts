import { useLikeCommentMutation } from '@/entities/interaction/api/interaction.queries';
import { Comment } from '@/entities/comment/model/comment.schema';
import { Post } from '@/entities/post/model/post.schema';

export function useLikeComment(commentId: Comment['id'], postId: Post['id']) {
  return useLikeCommentMutation(commentId, postId);
}
