import { Post } from '@/entities/post/model/post.schema';
import { Button } from '@/shared/ui/atoms/button';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useLikePost } from '@/features/post/like/hooks/useLikePost';

interface LikePostButtonProps {
  postId: Post['id'];
  isLiked: boolean;
  likeCount: number;
}

export function LikePostButton({ postId, isLiked, likeCount }: LikePostButtonProps) {
  const { mutateAsync: likePost, isPending: isLiking } = useLikePost(postId);

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    likePost();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'gap-1 md:gap-1.5 h-6 md:h-8 px-2 md:px-3 text-[10px] md:text-sm rounded-full hover:bg-background/80',
        isLiked && 'text-red-500 hover:text-red-600'
      )}
      onClick={handleLike}
      disabled={isLiking}
    >
      <ThumbsUp
        className={cn(
          'h-3.5 w-3.5 md:h-4 md:w-4',
          isLiked && 'fill-current',
          isLiking && 'animate-pulse opacity-50'
        )}
      />
      <span className="font-bold select-none">{likeCount}</span>
    </Button>
  );
}
