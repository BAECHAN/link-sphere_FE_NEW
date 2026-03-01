import { useBookmarkPostMutation } from '@/domains/post/_common/api/interaction.queries';
import { Post } from '@/domains/post/_common/model/post.schema';

export function useBookmarkPost(postId: Post['id']) {
  return useBookmarkPostMutation(postId);
}
