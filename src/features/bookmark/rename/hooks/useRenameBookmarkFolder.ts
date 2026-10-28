import { KeyboardEvent, useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { ErrorUtil } from '@/shared/utils/error.util';
import { useUpdateBookmarkFolderMutation } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';

interface UseRenameBookmarkFolderParams {
  folder: BookmarkFolder;
}

/**
 * 폴더 이름 바꾸기 — 사이드바 행·모바일 카드(useFolderActions)와 폴더 화면 제목(BookmarkFolderTitle)이 공유한다.
 * Enter·blur는 저장, Escape는 원래 이름으로 되돌린다(docs/BOOKMARK.md §5 "폴더 화면에서 이름 바꾸기").
 */
export const useRenameBookmarkFolder = ({ folder }: UseRenameBookmarkFolderParams) => {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folder.name);
  const { mutateAsync: updateFolder, isPending: isUpdating } = useUpdateBookmarkFolderMutation(
    folder.id
  );
  const submittingRef = useRef(false);
  const nameError = BookmarkFolderUtil.nameLengthError(name);

  // 열 때마다 지금 이름으로 맞춘다 — 데스크톱은 사이드바와 제목이 같은 폴더를 함께 그려, 한쪽에서 바꾼 뒤
  // 다른 쪽을 열면 처음 그릴 때의 옛 이름이 들어 있었다
  const startRename = () => {
    setName(folder.name);
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

    // 너무 길면 입력을 닫지 않는다 — 입력 아래 문구로 이유를 보여 준 채 고칠 기회를 둔다(blur로
    // 닫아 버리면 쓰던 이름이 사라진다). Escape는 지금처럼 원래 이름으로 되돌린다
    if (nameError) {
      return;
    }

    submittingRef.current = true;
    try {
      await updateFolder({ name: next });
      setRenaming(false);
    } catch (error) {
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

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

  return {
    renaming,
    startRename,
    name,
    setName,
    nameError,
    isUpdating,
    submitRename,
    handleRenameKeyDown,
  };
};
