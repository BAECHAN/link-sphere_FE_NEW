import { Comment } from '@/entities/comment/model/comment.schema';
import { Post } from '@/entities/post/model/post.schema';
import { Heart } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { useLikeComment } from '@/features/comment/like/hooks/useLikeComment';
import { useAuthGuard } from '@/entities/user/hooks/useAuthGuard';
import { Button } from '@/shared/ui/atoms/button';

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
  const guard = useAuthGuard();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => guard(() => likeMutation.mutate())}
      className={cn(
        'flex items-center gap-1 h-auto px-2 hover:text-destructive transition-colors',
        isLiked && 'text-destructive font-medium'
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', isLiked && 'fill-current')} />
      <span>{likeCount > 0 ? likeCount : TEXTS.comment.item.like}</span>
    </Button>
  );
}
