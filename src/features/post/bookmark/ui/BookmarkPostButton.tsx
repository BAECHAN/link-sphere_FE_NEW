import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Post } from '@/entities/post/model/post.schema';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { FolderSelector } from '@/features/post/bookmark/ui/FolderSelector';

interface BookmarkPostButtonProps {
  postId: Post['id'];
  isBookmarked: boolean;
  bookmarkFolderId: string | null;
}

/**
 * 북마크 버튼.
 * - 클릭 → FolderSelector 오픈 (YouTube Music 보관함 스타일)
 * - 폴더 선택은 FolderSelector 안에서 처리
 */
export function BookmarkPostButton({
  postId,
  isBookmarked,
  bookmarkFolderId,
}: BookmarkPostButtonProps) {
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-8 w-8 md:h-9 md:w-9 rounded-full',
          isBookmarked ? 'text-warning hover:text-warning/80' : 'text-muted-foreground'
        )}
        onClick={handleClick}
        aria-label={isBookmarked ? '북마크 폴더 변경' : '북마크 저장'}
      >
        <Bookmark className={cn('h-3.5 w-3.5 md:h-4.5 md:w-4.5', isBookmarked && 'fill-current')} />
        <span className="sr-only">Bookmark</span>
      </Button>

      <FolderSelector
        postId={postId}
        isBookmarked={isBookmarked}
        currentFolderId={bookmarkFolderId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
