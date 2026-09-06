import { KeyboardEvent, useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';
import {
  useDeleteFolderMutation,
  useUpdateFolderMutation,
} from '@/entities/folder/api/folder.queries';
import { Folder } from '@/entities/folder/model/folder.schema';

interface UseFolderActionsParams {
  folder: Folder;
  /** 삭제 확정 직후 · DELETE 요청 전에 실행. 데스크탑에서 "현재 선택된 폴더면 먼저 전체로 이동" 용도. */
  onBeforeDelete?: () => void;
}

/**
 * 폴더 이름변경(rename) + 삭제(delete) 로직 — FolderTree(FolderItem)·MobileFolderList(FolderCard)가 공유한다.
 */
export const useFolderActions = ({ folder, onBeforeDelete }: UseFolderActionsParams) => {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const { mutateAsync: updateFolder, isPending: isUpdating } = useUpdateFolderMutation(folder.id);
  const { mutateAsync: deleteFolder } = useDeleteFolderMutation(folder.id);
  const { openConfirm } = useAlert();
  const submittingRef = useRef(false);

  const startRename = () => {
    setRenaming(true);
  };

  const submitRename = async () => {
    if (submittingRef.current || isUpdating) {
      return;
    }
    const next = name.trim();
    if (!next || next === folder.name) {
      setRenaming(false);
      setName(folder.name);
      return;
    }
    submittingRef.current = true;
    try {
      await updateFolder({ name: next });
      setRenaming(false);
    } catch {
      toast.error(TEXTS.messages.error.folderRenameFailed);
      setName(folder.name);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter') {
      submitRename();
    }
    if (e.key === 'Escape') {
      setRenaming(false);
      setName(folder.name);
    }
  };

  const handleDelete = () => {
    openConfirm({
      title: TEXTS.bookmark.folder.deleteConfirmTitle(folder.name),
      message: TEXTS.bookmark.folder.deleteConfirmMessage,
      confirmText: TEXTS.buttons.delete,
      cancelText: TEXTS.buttons.cancel,
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
    renaming,
    startRename,
    name,
    setName,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
    handleDelete,
  };
};
