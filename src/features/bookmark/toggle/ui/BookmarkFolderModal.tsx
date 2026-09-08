import { TEXTS } from '@/shared/config/texts';
import { FolderPickerModal } from '@/entities/bookmark/folder/ui/FolderPickerModal';
import { useBookmarkFolderModal } from '@/features/bookmark/toggle/hooks/useBookmarkFolderModal';

interface BookmarkFolderModalProps {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 북마크 폴더 선택 UI — 즉시 저장(탭 = 바로 저장/제거 + 닫힘) 동작은
 * useBookmarkFolderModal이 소유하고, 실제 모달 마크업(행 구성·최근 구획·새 폴더 만들기)은
 * 등록 폼의 BookmarkFolderField와 공유하는 entities/bookmark/folder/ui/FolderPickerModal 이
 * 담당한다.
 */
export function BookmarkFolderModal({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
}: BookmarkFolderModalProps) {
  const { wasBookmarkedOnOpen, handleSelectUncategorized, handleSelectFolder, handleRemove } =
    useBookmarkFolderModal({ postId, isBookmarked, bookmarkFolderIds, open, onOpenChange });

  return (
    <FolderPickerModal
      open={open}
      onOpenChange={onOpenChange}
      description={TEXTS.bookmark.folder.selectorDescription}
      isBookmarked={isBookmarked}
      selectedFolderIds={bookmarkFolderIds}
      onSelectUncategorized={handleSelectUncategorized}
      onSelectFolder={handleSelectFolder}
      dangerAction={
        wasBookmarkedOnOpen
          ? { label: TEXTS.bookmark.folder.removeBookmark, onClick: handleRemove }
          : undefined
      }
    />
  );
}
