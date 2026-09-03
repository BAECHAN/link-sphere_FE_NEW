import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { FolderPickerDialog } from '@/entities/folder/ui/FolderPickerDialog';
import type { Folder } from '@/entities/folder/model/folder.schema';
import { useBookmarkFolders } from '@/features/post/bookmark/hooks/useBookmarkFolders';

interface FolderSelectorProps {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 북마크 폴더 선택 UI — 즉시 저장(탭 = 바로 저장/제거 + 닫힘) 동작만 여기서 소유하고,
 * 실제 모달 마크업(행 구성·최근 구획·새 폴더 만들기)은 등록 폼의 BookmarkFolderPicker와
 * 공유하는 entities/folder/ui/FolderPickerDialog 가 담당한다.
 */
export function FolderSelector({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
}: FolderSelectorProps) {
  const navigate = useNavigate();
  const { selectUncategorized, selectFolder, removeBookmark } = useBookmarkFolders(
    postId,
    isBookmarked,
    bookmarkFolderIds
  );

  // 셀렉터를 연 시점의 북마크 여부를 고정한다. 저장 중 낙관적 갱신으로 isBookmarked가
  // true로 바뀌어도, 닫힘 애니메이션 동안 '삭제하기' 버튼이 깜빡이지 않도록 방지한다.
  const [wasBookmarkedOnOpen, setWasBookmarkedOnOpen] = useState(isBookmarked);
  useEffect(
    function snapshotBookmarkStateOnOpen() {
      if (open) {
        setWasBookmarkedOnOpen(isBookmarked);
      }
      // open 이 true 로 전환되는 순간에만 스냅샷 — 저장 중 isBookmarked 변화는 의도적으로 무시
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  // 저장 결과를 바로 확인할 수 있게 저장된 폴더로 데려간다. 액션과 닫기 버튼이 자리를 다투므로
  // FCM 알림 토스트와 동일하게 액션이 있을 때는 닫기 버튼을 끈다.
  const viewSavedOptions = (folderKey: string) => ({
    action: {
      label: TEXTS.bookmark.folder.viewAction,
      onClick: () => navigate(`${ROUTES_PATHS.BOOKMARK}?folder=${folderKey}`),
    },
    closeButton: false,
  });

  const handleSelectUncategorized = async () => {
    // 이미 1개 이상의 폴더에 소속돼 있었다면 이번 탭은 "전체 해제" — 폴더 하나가 아니라
    // 여러 폴더에서 한꺼번에 빠졌다는 걸 알려야 하므로 일반 저장 문구와 구분한다.
    const wasInFolders = isBookmarked && bookmarkFolderIds.length > 0;

    try {
      await selectUncategorized();
      toast.success(
        wasInFolders
          ? TEXTS.messages.success.bookmarkClearedAllFolders
          : TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized),
        viewSavedOptions('uncategorized')
      );
      onOpenChange(false);
    } catch {
      toast.error(TEXTS.messages.error.bookmarkSaveFailed);
    }
  };

  const handleSelectFolder = async (folder: Folder) => {
    const wasSelected = bookmarkFolderIds.includes(folder.id);
    // 이게 마지막 폴더였다면 제거 후 결과가 미분류이므로, "미분류에 저장되었습니다."
    // 토스트를 재사용하되 왜 미분류가 됐는지 헷갈리지 않도록 description으로 이유를 덧붙인다.
    const isLastFolder = wasSelected && bookmarkFolderIds.length === 1;

    try {
      await selectFolder(folder.id);
      if (isLastFolder) {
        toast.success(TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized), {
          description: TEXTS.messages.success.bookmarkAutoUncategorizedDescription,
          ...viewSavedOptions('uncategorized'),
        });
      } else if (wasSelected) {
        toast.success(TEXTS.messages.success.bookmarkRemovedFromFolder(folder.name));
      } else {
        toast.success(
          TEXTS.messages.success.bookmarkSavedTo(folder.name),
          viewSavedOptions(folder.id)
        );
      }
      onOpenChange(false);
    } catch {
      toast.error(
        wasSelected
          ? TEXTS.messages.error.bookmarkRemoveFromFolderFailed
          : TEXTS.messages.error.bookmarkSaveFailed
      );
    }
  };

  const handleRemove = async () => {
    try {
      await removeBookmark();
      onOpenChange(false);
    } catch {
      toast.error(TEXTS.messages.error.bookmarkRemoveFailed);
    }
  };

  return (
    <FolderPickerDialog
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
