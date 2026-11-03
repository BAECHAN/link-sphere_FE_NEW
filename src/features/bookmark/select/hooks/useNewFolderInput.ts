import { useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { ErrorUtil } from '@/shared/utils/error.util';
import { useCreateBookmarkFolderMutation } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';

interface UseNewFolderInputParams {
  /** 만든 폴더로 입력을 접고 그 폴더를 고른다 — 행별 pending은 모달 훅(useBookmarkFolderSelect)이 갖고 있다 */
  onCreated: (folder: BookmarkFolder) => Promise<void>;
}

/**
 * 폴더 선택 모달의 "새 폴더 만들기" 입력 — 입력값과 생성 요청을 이 입력 안에 둔다. 모달 훅에 두면 한 글자마다
 * 모달 본문과 폴더 행 전부가 다시 그려진다(https://react.dev/reference/react/memo 의 "필요 이상으로 상태를
 * 끌어올리지 않는다"). 형태는 widgets/bookmark/folder-tree의 useCreateFolderForm을 따른다.
 */
export function useNewFolderInput({ onCreated }: UseNewFolderInputParams) {
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderNameError = BookmarkFolderUtil.nameLengthError(newFolderName);
  const { mutateAsync: createFolder, isPending: isCreating } = useCreateBookmarkFolderMutation();
  const submittingRef = useRef(false);

  const handleCreateAndSelect = async () => {
    if (submittingRef.current || isCreating) {
      return;
    }

    const name = newFolderName.trim();

    if (!name || newFolderNameError) {
      return;
    }

    submittingRef.current = true;

    try {
      const created = await createFolder({ name });
      await onCreated(created);
    } catch (error) {
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      toast.error(TEXTS.messages.error.folderCreateFailedFull);
    } finally {
      submittingRef.current = false;
    }
  };

  return {
    newFolderName,
    setNewFolderName,
    newFolderNameError,
    isCreating,
    handleCreateAndSelect,
  };
}
