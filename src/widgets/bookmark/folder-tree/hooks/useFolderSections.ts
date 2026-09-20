import { useBookmarkFolderListQuery } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';

/**
 * 폴더 목록 조회 + "최근 저장한 폴더" 구획을 함께 제공하는 훅.
 * FolderTree(데스크탑)·MobileFolderList(모바일)가 공유한다.
 *
 * 상단 구획은 스냅샷 없이 매 렌더 최신 `folderList`로 다시 계산한다 — 이 두 화면은
 * 페이지 방문 내내 떠 있어서 새 스냅샷을 찍을 계기(모달의 열림 전환 같은 것)가 아예
 * 없다. 그래서 같은 화면에서 글을 폴더로 옮겨도 새로고침 전까지 옛 순서가 남아 있었다
 * (2026-09-21, docs/BOOKMARK.md §10). 순서 고정(split menu 공간기억, §5)은 탭 한 번에
 * 닫히는 모달(features/bookmark/select/hooks/useBookmarkFolderSelect.ts)만 유지한다.
 */
export const useFolderSections = () => {
  const { data, isLoading } = useBookmarkFolderListQuery();
  const folderList = data?.folders;
  const uncategorizedCount = data ? (data.uncategorizedCount ?? 0) : undefined;
  const recentFolderList = BookmarkFolderUtil.pickRecentFolders(folderList ?? []);

  return {
    folderList,
    uncategorizedCount,
    recentFolderList,
    isLoading,
  };
};
