import { useFolderListQuery } from '@/entities/folder/api/folder.queries';
import { useRecentFolders } from '@/entities/folder/model/useRecentFolders';

/**
 * 폴더 목록 조회 + "최근 저장한 폴더" 스냅샷을 함께 제공하는 훅.
 * FolderTree(데스크탑)·MobileFolderList(모바일)가 공유한다.
 */
export const useFolderSections = () => {
  const { data, isLoading, isFetching } = useFolderListQuery();
  const folders = data?.folders;
  const uncategorizedCount = data ? (data.uncategorizedCount ?? 0) : undefined;
  // 상단 "최근 저장한 폴더" 구획 — 페이지 방문(마운트) 동안 1회 스냅샷, 그 뒤로는 고정
  const { recentFolders } = useRecentFolders(folders ?? [], isFetching);

  return {
    folders,
    uncategorizedCount,
    recentFolders,
    isLoading,
  };
};
