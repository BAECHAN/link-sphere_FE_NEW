import { useId, useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { ErrorUtil } from '@/shared/utils/error.util';
import { useCreateBookmarkFolderMutation } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';

interface UseCreateFolderFormParams {
  /** 생성 성공 직후 실행 — 데스크탑은 입력 닫기(onClose), 모바일은 입력 폼 접기(setCreating(false)) */
  onCreated: () => void;
}

/**
 * 폴더 생성 폼 코어 로직 — FolderSidebar(InlineCreateFolderInput)·
 * MobileFolderList(CreateFolderCard)가 공유한다.
 */
export const useCreateFolderForm = ({ onCreated }: UseCreateFolderFormParams) => {
  const [name, setName] = useState('');
  const { mutateAsync: createFolder, isPending } = useCreateBookmarkFolderMutation();
  const submittingRef = useRef(false);
  // 입력하는 동안 바로 아래에 이유를 띄우고(생성 버튼도 막는다), 제출도 막는다
  const nameError = BookmarkFolderUtil.nameLengthError(name);
  // 입력 아래 글자 수(n / 15자) - nameError와 같은 셈법이라 넘는 시점이 같다.
  // id는 입력 aria-describedby용이다(https://react.dev/reference/react/useId)
  const nameLength = BookmarkFolderUtil.nameLength(name);
  const nameCountId = useId();

  const submit = async () => {
    if (submittingRef.current || isPending) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed || nameError) {
      return;
    }
    submittingRef.current = true;
    try {
      await createFolder({ name: trimmed });
      setName('');
      onCreated();
    } catch (error) {
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      toast.error(
        BookmarkFolderUtil.resolveNameSaveErrorMessage(
          error,
          TEXTS.messages.error.folderCreateFailed
        )
      );
    } finally {
      submittingRef.current = false;
    }
  };

  return {
    name,
    setName,
    nameError,
    nameLength,
    nameCountId,
    isPending,
    submit,
  };
};
