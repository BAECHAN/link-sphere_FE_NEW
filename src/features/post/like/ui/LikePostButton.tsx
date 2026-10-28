import { Post } from '@/entities/post/model/post.schema';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useLikePost } from '@/features/post/like/hooks/useLikePost';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { TEXTS } from '@/shared/config/texts';
import { NumberUtil } from '@/shared/utils/number.util';

interface LikePostButtonProps {
  postId: Post['id'];
  isLiked: boolean;
  likeCount: number;
}

export function LikePostButton({ postId, isLiked, likeCount }: LikePostButtonProps) {
  // mutateAsync는 실패를 throw해 아무도 잡지 않으면 "Uncaught (in promise)"가 남는다 — 실패
  // 처리(롤백)는 mutation 쪽에 있으니 결과를 기다리지 않는 mutate를 쓴다.
  const { mutate: likePost } = useLikePost(postId);
  const guard = useAuthGuard();

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    guard(() => likePost(!isLiked));
  };

  return (
    <ToggleButton
      variant="none"
      size="sm"
      className={cn(
        'gap-1 md:gap-1.5 h-6 md:h-8 px-2 md:px-3 text-micro md:text-sm rounded-full hover:bg-background/80',
        isLiked && 'text-destructive hover:text-destructive/80'
      )}
      onClick={handleLike}
      aria-label={isLiked ? TEXTS.ariaLabels.postUnlike : TEXTS.ariaLabels.postLike}
    >
      <ThumbsUp className={cn('size-4', isLiked && 'fill-current')} />
      <span className="font-bold select-none">{NumberUtil.formatCompact(likeCount)}</span>
    </ToggleButton>
  );
}
