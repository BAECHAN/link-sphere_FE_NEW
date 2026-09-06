import { useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { useCreateFolderMutation } from '@/entities/folder/api/folder.queries';

interface UseCreateFolderFormParams {
  /** 생성 성공 직후 실행 — 데스크탑은 입력 닫기(onClose), 모바일은 입력 폼 접기(setCreating(false)) */
  onCreated: () => void;
}

/**
 * 폴더 생성 폼 코어 로직 — FolderTree(InlineCreateFolderInput·FolderChips)·
 * MobileFolderList(CreateFolderCard)가 공유한다.
 */
export const useCreateFolderForm = ({ onCreated }: UseCreateFolderFormParams) => {
  const [name, setName] = useState('');
  const { mutateAsync: createFolder, isPending } = useCreateFolderMutation();
  const submittingRef = useRef(false);

  const submit = async () => {
    if (submittingRef.current || isPending) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    submittingRef.current = true;
    try {
      await createFolder({ name: trimmed });
      setName('');
      onCreated();
    } catch {
      toast.error(TEXTS.messages.error.folderCreateFailed);
    } finally {
      submittingRef.current = false;
    }
  };

  return {
    name,
    setName,
    isPending,
    submit,
  };
};
