import { Comment } from '@/entities/comment/model/comment.schema';
import { Post } from '@/entities/post/model/post.schema';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useLikeComment } from '@/features/comment/like/hooks/useLikeComment';

interface LikeCommentButtonProps {
  commentId: Comment['id'];
  postId: Post['id'];
  isLiked: boolean;
  likeCount: number;
}

export function LikeCommentButton({
  commentId,
  postId,
  isLiked,
  likeCount,
}: LikeCommentButtonProps) {
  const likeMutation = useLikeComment(commentId, postId);

  return (
    <button
      type="button"
      onClick={() => likeMutation.mutate()}
      className={cn(
        'flex items-center gap-1 hover:text-destructive transition-colors',
        isLiked && 'text-destructive font-medium'
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', isLiked && 'fill-current')} />
      <span>{likeCount > 0 ? likeCount : '좋아요'}</span>
    </button>
  );
}
