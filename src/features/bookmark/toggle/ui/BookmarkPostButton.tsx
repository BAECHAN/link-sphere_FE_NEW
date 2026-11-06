import { Bookmark } from 'lucide-react';
import { Post } from '@/entities/post/model/post.schema';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { useBookmarkPostButton } from '@/features/bookmark/toggle/hooks/useBookmarkPostButton';

interface BookmarkPostButtonProps {
  postId: Post['id'];
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
}

/**
 * 북마크 버튼.
 * - 클릭 → 폴더 선택 창 오픈 (YouTube Music 보관함 스타일). 창은 RootLayout의 호스트가 그린다
 *   (GlobalPostBookmarkFolderDialog — 카드가 목록에서 빠져도 창이 끝까지 닫히게)
 * - 비로그인이면 로그인 모달을 띄우고, 로그인 성공 시 자동으로 이어서 열린다
 * - 열기·hover 프리페치 로직은 useBookmarkPostButton이 소유한다
 */
export function BookmarkPostButton({
  postId,
  isBookmarked,
  bookmarkFolderIds,
}: BookmarkPostButtonProps) {
  const { handleClick, handlePrefetch } = useBookmarkPostButton({
    postId,
    isBookmarked,
    bookmarkFolderIds,
  });

  return (
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
    </Button>
  );
}
