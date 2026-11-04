import { KeyboardEvent, useRef, useState } from 'react';
import { useBackCloseRequest } from '@/shared/hooks/useBackClosableOverlay';
import { useFolderSections } from '@/widgets/bookmark/folder-tree/hooks/useFolderSections';
import { useCreateFolderForm } from '@/widgets/bookmark/folder-tree/hooks/useCreateFolderForm';
import { useFollowFocusOnReorder } from '@/widgets/bookmark/folder-tree/hooks/useFollowFocusOnReorder';

/** MobileFolderList 루트 */
export const useMobileFolderList = () => {
  const sections = useFolderSections();
  const folderListRef = useRef<HTMLDivElement>(null);
  useFollowFocusOnReorder(folderListRef, sections.folderList?.map((folder) => folder.id) ?? []);

  return { ...sections, folderListRef };
};

/** CreateFolderCard — creating 토글 + 생성 폼 */
export const useCreateFolderCard = () => {
  const [creating, setCreating] = useState(false);
  const { name, setName, nameError, nameLength, nameCountId, isPending, submit } =
    useCreateFolderForm({
      onCreated: () => setCreating(false),
    });

  const handleCancel = () => {
    setCreating(false);
    setName('');
  };

  // 입력이 열린 채 Android 뒤로가기를 누르면 페이지를 떠나지 않고 취소 버튼처럼 접는다(docs/BOOKMARK.md §5).
  // 생성 요청 중엔 취소 버튼처럼 받지 않는다
  useBackCloseRequest(() => {
    if (isPending) {
      return;
    }

    handleCancel();
  }, creating);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME(한글 등) 조합 중 엔터는 무시 — 조합 완료 + Enter 가 동시 발생해 submit 중복 호출되는 것을 방지
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter') {
      submit();
    }
    if (e.key === 'Escape') {
      handleCancel();
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
    nameError,
    nameLength,
    nameCountId,
    isPending,
    submit,
    handleCancel,
    handleKeyDown,
    handleBlur,
  };
};
