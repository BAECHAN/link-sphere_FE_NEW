import { useLikePostMutation } from '@/entities/interaction/api/interaction.queries';
import { Post } from '@/entities/post/model/post.schema';

export function useLikePost(postId: Post['id']) {
  return useLikePostMutation(postId);
}
