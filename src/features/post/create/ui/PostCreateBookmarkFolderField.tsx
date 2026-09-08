import { ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';
import { BookmarkFolderSelectModal } from '@/entities/bookmark/folder/ui/BookmarkFolderSelectModal';
import { usePostCreateBookmarkFolderField } from '@/features/post/create/hooks/usePostCreateBookmarkFolderField';

/**
 * 링크 등록 폼(CreatePostForm)의 북마크 폴더 선택 필드.
 *
 * entities/bookmark/folder/ui/BookmarkFolderSelectModal 를 features/bookmark/toggle/ui/PostCardBookmarkFolderModal
 * 와 공유한다. 행 구성·모바일 바텀시트 전환은 동일하지만, 여기는 "지연 선택"이다 — 탭해도
 * 즉시 저장하지 않고 폼의 bookmark/folderIds 값만 바꾸고, 실제 북마크 생성은 등록
 * 제출(POST /post) 한 번에 서버가 처리한다.
 */
export function PostCreateBookmarkFolderField() {
  const {
    bookmark,
    folderIds,
    open,
    setOpen,
    triggerText,
    handleSelectUncategorized,
    handleSelectFolder,
    handleClearBookmark,
  } = usePostCreateBookmarkFolderField();

  return (
    <FormField name="folderIds" label={TEXTS.post.form.create.bookmarkLabel}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full min-h-11 md:min-h-0 justify-between font-normal"
      >
        <span
          className={cn('truncate', !bookmark && folderIds.length === 0 && 'text-muted-foreground')}
        >
          {triggerText}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      <BookmarkFolderSelectModal
        open={open}
        onOpenChange={setOpen}
        description={TEXTS.post.form.create.bookmarkSelect}
        isBookmarked={bookmark}
        selectedFolderIds={folderIds}
        onSelectUncategorized={handleSelectUncategorized}
        onSelectFolder={handleSelectFolder}
        dangerAction={{ label: TEXTS.post.form.create.bookmarkNone, onClick: handleClearBookmark }}
        showConfirmButton
      />
    </FormField>
  );
}
