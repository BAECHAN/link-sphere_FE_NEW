import { useRef } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { useAlert } from '@/shared/ui/elements/dialog/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';
import {
  useDeleteBookmarkFolderMutation,
  useSetBookmarkFolderPinMutation,
} from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';
import { useRenameBookmarkFolder } from '@/features/bookmark/rename/hooks/useRenameBookmarkFolder';

interface UseFolderActionsParams {
  folder: BookmarkFolder;
  /** 삭제 확정 직후 · DELETE 요청 전에 실행. 데스크탑에서 "현재 선택된 폴더면 먼저 전체로 이동" 용도. */
  onBeforeDelete?: () => void;
}

/**
 * 폴더 고정(pin) + 이름변경(rename) + 삭제(delete) 로직 — FolderTree(FolderItem)·MobileFolderList(FolderCard)가 공유한다.
 * 이름변경은 폴더 화면 제목과 함께 쓰는 features 훅(useRenameBookmarkFolder)을 그대로 돌려준다.
 * 고정 실패 토스트·롤백은 mutation이 소유한다(useSetBookmarkFolderPinMutation).
 */
export const useFolderActions = ({ folder, onBeforeDelete }: UseFolderActionsParams) => {
  const {
    renaming,
    startRename,
    name,
    setName,
    nameError,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
  } = useRenameBookmarkFolder({ folder });
  const { mutateAsync: deleteFolder } = useDeleteBookmarkFolderMutation(folder.id);
  const { mutate: setPinned } = useSetBookmarkFolderPinMutation(folder.id);
  const isPinned = BookmarkFolderUtil.isPinned(folder);
  const { openConfirm } = useAlert();

  const togglePin = () => {
    setPinned(!isPinned);
  };

  // ⋮ 메뉴에서 고르면 메뉴가 다 닫힌 뒤에 보낸다 — 바로 보내면 행이 옮겨 가는 동안 닫히던 메뉴가 그 행을
  // 따라가 새 자리에서 "고정 해제"로 바뀐 채 사라졌다(docs/BOOKMARK.md §5)
  const pinAfterMenuCloseRef = useRef(false);

  const queuePinToggle = () => {
    pinAfterMenuCloseRef.current = true;
  };

  const handleMenuCloseAutoFocus = () => {
    if (!pinAfterMenuCloseRef.current) {
      return;
    }

    pinAfterMenuCloseRef.current = false;
    togglePin();
  };

  const handleDelete = () => {
    openConfirm({
      title: TEXTS.bookmark.folder.deleteConfirmTitle(folder.name),
      message: TEXTS.bookmark.folder.deleteConfirmMessage,
      confirmText: TEXTS.buttons.delete,
      cancelText: TEXTS.buttons.cancel,
      // 이미 삭제를 결심하고 도달한 다이얼로그다 - usePostDelete.ts와 동일 이유로
      // 확인을 채움+오른쪽으로 켠다(docs/DECISIONS.md 2026-09-29 항목).
      emphasis: 'confirm',
      onConfirm: async () => {
        onBeforeDelete?.();
        try {
          await deleteFolder();
        } catch {
          toast.error(TEXTS.messages.error.folderDeleteFailed);
        }
      },
    });
  };

  return {
    isPinned,
    queuePinToggle,
    handleMenuCloseAutoFocus,
    renaming,
    startRename,
    name,
    setName,
    nameError,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
    handleDelete,
  };
};
