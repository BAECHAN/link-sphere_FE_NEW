import { Bookmark } from 'lucide-react';
import { Post } from '@/entities/post/model/post.schema';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { PostCardBookmarkFolderDialog } from '@/features/bookmark/toggle/ui/PostCardBookmarkFolderDialog';
import { useBookmarkPostButton } from '@/features/bookmark/toggle/hooks/useBookmarkPostButton';

interface BookmarkPostButtonProps {
  postId: Post['id'];
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
}

/**
 * 북마크 버튼.
 * - 클릭 → PostCardBookmarkFolderDialog 오픈 (YouTube Music 보관함 스타일)
 * - 폴더 선택은 PostCardBookmarkFolderDialog 안에서 처리
 * - 비로그인이면 로그인 모달을 띄우고, 로그인 성공 시 자동으로 이어서 열린다
 * - 열림 상태(히스토리)·hover 프리페치 로직은 useBookmarkPostButton이 소유한다
 */
export function BookmarkPostButton({
  postId,
  isBookmarked,
  bookmarkFolderIds,
}: BookmarkPostButtonProps) {
  const { isOpen, handleClick, handleOpenChange, handlePrefetch } = useBookmarkPostButton(postId);

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
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        aria-label={isBookmarked ? TEXTS.ariaLabels.bookmarkChange : TEXTS.ariaLabels.bookmarkSave}
      >
        <Bookmark className={cn('size-4', isBookmarked && 'fill-current')} />
        <span className="sr-only">Bookmark</span>
      </Button>

      <PostCardBookmarkFolderDialog
        postId={postId}
        isBookmarked={isBookmarked}
        bookmarkFolderIds={bookmarkFolderIds}
        open={isOpen}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}
