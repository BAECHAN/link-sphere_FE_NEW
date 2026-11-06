import { useBookmarkFolderListQuery } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';

/**
 * 폴더 목록 조회 + "최근 저장한 폴더" 구획을 함께 제공하는 훅.
 * FolderSidebar(데스크탑)·MobileFolderList(모바일)가 공유한다. `folderList`("내 폴더")는 고정한 폴더를
 * 맨 위로 올린 순서다(BookmarkFolderUtil.orderPinnedFirst).
 *
 * 상단 구획은 스냅샷 없이 매 렌더 최신 `folderList`로 다시 계산한다 — 이 두 화면은
 * 페이지 방문 내내 떠 있어서 새 스냅샷을 찍을 계기(모달의 열림 전환 같은 것)가 아예
 * 없다. 그래서 같은 화면에서 글을 폴더로 옮겨도 새로고침 전까지 옛 순서가 남아 있었다
 * (2026-09-21, docs/BOOKMARK.md §10). 순서 고정(split menu 공간기억, §5)은 탭 한 번에
 * 닫히는 모달(features/bookmark/select/hooks/useBookmarkFolderSelect.ts)만 유지한다.
 */
export const useFolderSections = () => {
  // 기다리는 화면은 isLoading이 아니라 isPending(데이터 없음)으로 판단한다 - 오프라인이라 요청이 멈추면(fetchStatus
  // paused) isLoading이 거짓이라 폴더가 없는 사람처럼 빈칸이 떴다. 다시 연결되면 저절로 받는다(폴더 선택 창과 같음)
  const { data, isPending, isError, refetch } = useBookmarkFolderListQuery();
  // 목록을 한 번도 받지 못하고 실패했다 - 폴더 자리에 안내와 다시 시도를 둔다. 받아 둔 목록이 있으면 다시 받기가
  // 실패해도 그 목록을 그대로 보인다(실패 토스트는 전역 핸들러가 띄운다)
  const isFolderListFailed = isError && data === undefined;
  const folderList = data ? BookmarkFolderUtil.orderPinnedFirst(data.folders) : undefined;
  const uncategorizedCount = data ? (data.uncategorizedCount ?? 0) : undefined;
  const recentFolderList = BookmarkFolderUtil.pickRecentFolders(data?.folders ?? []);

  // 데이터 없이 다시 받으면 isPending으로 돌아가 스피너가 먼저 보인다
  const retryFolderList = () => {
    refetch();
  };

  return {
    folderList,
    uncategorizedCount,
    recentFolderList,
    isPending,
    isFolderListFailed,
    retryFolderList,
  };
};
