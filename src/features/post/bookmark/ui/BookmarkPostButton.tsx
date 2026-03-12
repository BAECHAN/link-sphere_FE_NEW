import { Post } from '@/entities/post/model/post.schema';
import { Button } from '@/shared/ui/atoms/button';
import { Bookmark } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useBookmarkPost } from '@/features/post/bookmark/hooks/useBookmarkPost';

interface BookmarkPostButtonProps {
  postId: Post['id'];
  isBookmarked: boolean;
}

export function BookmarkPostButton({ postId, isBookmarked }: BookmarkPostButtonProps) {
  const { mutateAsync: bookmarkPost, isPending: isBookmarking } = useBookmarkPost(postId);

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    bookmarkPost();
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 md:h-9 md:w-9 rounded-full ${isBookmarked ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground'}`}
      onClick={handleBookmark}
      disabled={isBookmarking}
    >
      <Bookmark
        className={cn(
          'h-3.5 w-3.5 md:h-4.5 md:w-4.5',
          isBookmarked ? 'fill-current' : '',
          isBookmarking && 'animate-pulse opacity-50'
        )}
      />
      <span className="sr-only">Bookmark</span>
    </Button>
  );
}
