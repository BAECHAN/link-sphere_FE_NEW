import { TEXTS } from '@/shared/config/texts';
import { FolderPickerModal } from '@/entities/bookmark/folder/ui/FolderPickerModal';
import { usePostCardBookmarkFolderModal } from '@/features/bookmark/toggle/hooks/usePostCardBookmarkFolderModal';

interface PostCardBookmarkFolderModalProps {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 북마크 폴더 선택 UI — PostCard(피드·상세·북마크 페이지가 공유하는 위젯)의 북마크
 * 버튼에서 열리는 즉시 저장(탭 = 바로 저장/제거 + 닫힘) 버전. 동작은
 * usePostCardBookmarkFolderModal이 소유하고, 실제 모달 마크업(행 구성·최근 구획·새 폴더
 * 만들기)은 등록 폼의 PostCreateBookmarkFolderField와 공유하는
 * entities/bookmark/folder/ui/FolderPickerModal 이 담당한다.
 */
export function PostCardBookmarkFolderModal({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
}: PostCardBookmarkFolderModalProps) {
  const { wasBookmarkedOnOpen, handleSelectUncategorized, handleSelectFolder, handleRemove } =
    usePostCardBookmarkFolderModal({ postId, isBookmarked, bookmarkFolderIds, open, onOpenChange });

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
