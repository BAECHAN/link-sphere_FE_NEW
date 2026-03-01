import { useLikePostMutation } from '@/domains/post/_common/api/interaction.queries';
import { Post } from '@/domains/post/_common/model/post.schema';

export function useLikePost(postId: Post['id']) {
  return useLikePostMutation(postId);
}
