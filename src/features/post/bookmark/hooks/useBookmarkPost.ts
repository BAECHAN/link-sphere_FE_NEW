import { useBookmarkPostMutation } from '@/entities/interaction/api/interaction.queries';
import { Post } from '@/entities/post/model/post.schema';

export function useBookmarkPost(postId: Post['id']) {
  return useBookmarkPostMutation(postId);
}
