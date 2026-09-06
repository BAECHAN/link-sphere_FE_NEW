import { KeyboardEvent, useState } from 'react';
import { prefetchFolderPosts, useFolderListQuery } from '@/entities/folder/api/folder.queries';
import { Folder, FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';
import { useFolderSections } from '@/widgets/bookmark/folder-tree/hooks/useFolderSections';
import { useFolderActions } from '@/widgets/bookmark/folder-tree/hooks/useFolderActions';
import { useCreateFolderForm } from '@/widgets/bookmark/folder-tree/hooks/useCreateFolderForm';

/** FolderTree(데스크탑 사이드바) 루트 */
export const useFolderTree = (sort?: FolderSort, search?: string) => {
  const { folders, uncategorizedCount, recentFolders, isLoading } = useFolderSections();

  const prefetchFolder = (folderKey: FolderKey) => {
    prefetchFolderPosts(folderKey, sort, search);
  };

  return {
    folders,
    uncategorizedCount,
    recentFolders,
    isLoading,
    prefetchFolder,
  };
};

/** FolderItem(폴더 행) — 선택된 폴더를 삭제하면 먼저 전체로 이동 */
export const useFolderItem = (folder: Folder, selected: boolean, onDeleted: () => void) =>
  useFolderActions({
    folder,
    onBeforeDelete: () => {
      // 현재 보고 있는 폴더면 먼저 전체로 이동 → 삭제 후 invalidate 시 죽은 폴더 쿼리가 refetch(404)되지 않도록 언마운트
      if (selected) {
        onDeleted();
      }
    },
  });

/** CreateFolderInput(버튼 ↔ 인라인 입력 토글) */
export const useCreateFolderInput = () => {
  const [creating, setCreating] = useState(false);

  return {
    creating,
    startCreating: () => setCreating(true),
    stopCreating: () => setCreating(false),
  };
};

/** InlineCreateFolderInput */
export const useInlineCreateFolderInput = (onClose: () => void) => {
  const { name, setName, isPending, submit } = useCreateFolderForm({ onCreated: onClose });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // IME(한글 등) 조합 중 엔터는 무시 — 조합 완료 + Enter 가 동시 발생해 submit 중복 호출되는 것을 방지
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter') {
      submit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleBlur = () => {
    if (!name) {
      onClose();
    }
  };

  return {
    name,
    setName,
    isPending,
    submit,
    handleKeyDown,
    handleBlur,
  };
};

/** FolderChips(모바일 상단 가로 칩) */
export const useFolderChips = () => {
  const { data } = useFolderListQuery();
  const folders = data?.folders;
  const uncategorizedCount = data?.uncategorizedCount ?? 0;
  const [creating, setCreating] = useState(false);

  return {
    folders,
    uncategorizedCount,
    creating,
    startCreating: () => setCreating(true),
    stopCreating: () => setCreating(false),
  };
};
