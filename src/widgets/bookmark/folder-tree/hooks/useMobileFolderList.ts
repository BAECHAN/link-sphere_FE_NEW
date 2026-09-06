import { KeyboardEvent, useState } from 'react';
import { useFolderSections } from '@/widgets/bookmark/folder-tree/hooks/useFolderSections';
import { useCreateFolderForm } from '@/widgets/bookmark/folder-tree/hooks/useCreateFolderForm';

/** MobileFolderList 루트 */
export const useMobileFolderList = () => useFolderSections();

/** CreateFolderCard — creating 토글 + 생성 폼 */
export const useCreateFolderCard = () => {
  const [creating, setCreating] = useState(false);
  const { name, setName, isPending, submit } = useCreateFolderForm({
    onCreated: () => setCreating(false),
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME(한글 등) 조합 중 엔터는 무시 — 조합 완료 + Enter 가 동시 발생해 submit 중복 호출되는 것을 방지
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter') {
      submit();
    }
    if (e.key === 'Escape') {
      setCreating(false);
      setName('');
    }
  };

  const handleBlur = () => {
    if (!name && !isPending) {
      setCreating(false);
    }
  };

  return {
    creating,
    startCreating: () => setCreating(true),
    name,
    setName,
    isPending,
    submit,
    handleKeyDown,
    handleBlur,
  };
};
