import { useState } from 'react';
import { useBookmarkFolderListQuery } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { useRecentBookmarkFolders } from '@/entities/bookmark/folder/hooks/useRecentBookmarkFolders';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';

// 미분류 행의 pending 식별자 — folderKey 관례('all' | 'uncategorized' | UUID)와 동일한 sentinel이라
// 실제 폴더 UUID와 충돌하지 않는다.
export const UNCATEGORIZED_PENDING_KEY = 'uncategorized';

interface UseBookmarkFolderSelectParams {
  open: boolean;
  isBookmarked: boolean;
  selectedFolderIds: string[];
  onSelectUncategorized: () => void | Promise<void>;
  onSelectFolder: (folder: BookmarkFolder) => void | Promise<void>;
}

/**
 * 폴더 선택 모달(BookmarkFolderSelectDialog)의 로직 — 폴더 목록 조회·생성 입력 펼침·행별 pending
 * 상태를 소유한다. 새 폴더 이름과 생성 요청은 입력 쪽(useNewFolderInput)이 갖는다. 저장 동작
 * 자체(성공 토스트·닫기·라우팅)는 호출부가 콜백으로 넘긴다.
 */
export function useBookmarkFolderSelect({
  open,
  isBookmarked,
  selectedFolderIds,
  onSelectUncategorized,
  onSelectFolder,
}: UseBookmarkFolderSelectParams) {
  // 기다리는 화면은 isLoading이 아니라 isPending(데이터 없음)으로 판단한다 - 오프라인이라 요청이 멈추면(fetchStatus
  // paused) isLoading이 거짓이라 빈 목록처럼 '미분류 0'이 떴다. 다시 연결되면 저절로 받는다
  const { data, isPending, isError, isFetching, refetch } = useBookmarkFolderListQuery({
    enabled: open,
  });
  // 목록을 한 번도 받지 못하고 실패했다 - 폴더 자리에 안내와 다시 시도를 둔다. 받아 둔 목록이 있으면 다시 받기가
  // 실패해도 그 목록을 그대로 보인다(실패 토스트는 전역 핸들러가 띄운다)
  const isFolderListFailed = isError && data === undefined;
  // 잘못 라우팅된 응답(HTML 등) 방어 — 배열이 아니면 빈 목록으로 처리해 화면 전체 크래시 방지
  const folderList = Array.isArray(data?.folders) ? data.folders : [];
  const uncategorizedCount = data?.uncategorizedCount ?? 0;
  // "내 폴더" — 고정한 폴더를 맨 위로 올린다. 스냅샷 없이 매번 계산한다 — 이 모달 안에는 고정을 바꾸는 조작이
  // 없어 열려 있는 동안 순서가 바뀌는 건 다른 기기에서 고정한 드문 경우뿐이다
  const orderedFolderList = BookmarkFolderUtil.orderPinnedFirst(folderList);
  // 상단 "최근 저장한 폴더" 구획 — 열 때마다(open) 새로 스냅샷, 열려있는 동안은 고정
  const { recentFolderList } = useRecentBookmarkFolders(folderList, isFetching, open);

  const [creatingMode, setCreatingMode] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);

  // 다이얼로그가 닫히면 생성 입력을 접는다 — 열려 있는 동안만 스스로 닫히는 즉시 저장
  // 경로(PostCardBookmarkFolderDialog)와 달리, 지연 선택(PostCreateBookmarkFolderField)은 확인 버튼으로 닫히므로
  // 여기서 공통으로 처리해야 다음에 열 때 입력창이 남아있지 않는다. 입력값은 접힐 때 입력 컴포넌트와 함께
  // 사라진다. effect가 아니라 렌더 중에
  // 맞춘다 (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (open !== prevOpen) {
    setPrevOpen(open);

    if (!open) {
      setCreatingMode(false);
    }
  }

  const isUncategorizedSelected = isBookmarked && selectedFolderIds.length === 0;
  // 파괴적 조작(폴더 탭 한 번으로 북마크가 완전 삭제될 수 있음, 2026-09-11)이 생겨
  // in-flight 중 다른 행을 탭하면 요청이 꼬일 수 있다 — 모달 전체를 잠근다.
  const isAnyPending = pendingKey !== null;

  const handleSelectUncategorized = async () => {
    // 이미 미분류(✓)면 파괴적 조작(북마크 완전 삭제)이 된다 — 폴더 행의 "마지막 폴더
    // 탭" 규칙과 동일하다(2026-09-11 재결정, docs/DECISIONS.md). 호출부가 되돌리기
    // 토스트를 붙인다.
    if (isAnyPending) {
      return;
    }

    setPendingKey(UNCATEGORIZED_PENDING_KEY);
    try {
      await onSelectUncategorized();
    } finally {
      setPendingKey(null);
    }
  };

  const handleSelectFolder = async (folder: BookmarkFolder) => {
    if (isAnyPending) {
      return;
    }

    setPendingKey(folder.id);
    try {
      await onSelectFolder(folder);
    } finally {
      setPendingKey(null);
    }
  };

  // 새 폴더를 만든 직후 — 입력을 접고 그 폴더를 고른다. 실패하면 입력 쪽(useNewFolderInput)이 토스트를 띄운다
  const handleFolderCreated = async (folder: BookmarkFolder) => {
    setCreatingMode(false);
    await handleSelectFolder(folder);
  };

  const handleCancelCreate = () => {
    setCreatingMode(false);
  };

  // 데이터 없이 다시 받으면 isPending으로 돌아가 기다리는 화면(골격)이 먼저 보인다
  const retryFolderList = () => {
    refetch();
  };

  return {
    isPending,
    isFolderListFailed,
    retryFolderList,
    folderList: orderedFolderList,
    uncategorizedCount,
    recentFolderList,
    isUncategorizedSelected,
    pendingKey,
    isAnyPending,
    creatingMode,
    setCreatingMode,
    handleSelectUncategorized,
    handleSelectFolder,
    handleFolderCreated,
    handleCancelCreate,
  };
}
