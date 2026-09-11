import { useEffect, useRef, useState } from 'react';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import {
  useCreateBookmarkFolderMutation,
  useBookmarkFolderListQuery,
} from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { useRecentBookmarkFolders } from '@/entities/bookmark/folder/hooks/useRecentBookmarkFolders';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';

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
 * 폴더 선택 모달(BookmarkFolderSelectModal)의 로직 전부 — 폴더 목록 조회·생성·행별 pending
 * 상태를 소유한다. 저장 동작 자체(성공 토스트·닫기·라우팅)는 호출부가 콜백으로 넘긴다.
 */
export function useBookmarkFolderSelect({
  open,
  isBookmarked,
  selectedFolderIds,
  onSelectUncategorized,
  onSelectFolder,
}: UseBookmarkFolderSelectParams) {
  const { data, isLoading, isFetching } = useBookmarkFolderListQuery({ enabled: open });
  // 잘못 라우팅된 응답(HTML 등) 방어 — 배열이 아니면 빈 목록으로 처리해 화면 전체 크래시 방지
  const folderList = Array.isArray(data?.folders) ? data.folders : [];
  const uncategorizedCount = data?.uncategorizedCount ?? 0;
  // 상단 "최근 저장한 폴더" 구획 — 열 때마다(open) 새로 스냅샷, 열려있는 동안은 고정
  const { recentFolderList } = useRecentBookmarkFolders(folderList, isFetching, open);
  const { mutateAsync: createFolder, isPending: isCreating } = useCreateBookmarkFolderMutation();

  const [creatingMode, setCreatingMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const submittingRef = useRef(false);

  // 다이얼로그가 닫히면 생성 입력 상태를 리셋한다 — 열려 있는 동안만 스스로 닫히는 즉시 저장
  // 경로(PostCardBookmarkFolderModal)와 달리, 지연 선택(PostCreateBookmarkFolderField)은 확인 버튼으로 닫히므로
  // 여기서 공통으로 처리해야 다음에 열 때 입력창이 남아있지 않는다.
  useEffect(() => {
    if (!open) {
      setCreatingMode(false);
      setNewFolderName('');
    }
  }, [open]);

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

  const handleCreateAndSelect = async () => {
    if (submittingRef.current || isCreating) {
      return;
    }

    const name = newFolderName.trim();

    if (!name) {
      return;
    }

    submittingRef.current = true;

    try {
      const created = await createFolder({ name });
      setNewFolderName('');
      setCreatingMode(false);
      await handleSelectFolder(created);
    } catch {
      toast.error(TEXTS.messages.error.folderCreateFailedFull);
    } finally {
      submittingRef.current = false;
    }
  };

  return {
    isLoading,
    folderList,
    uncategorizedCount,
    recentFolderList,
    isUncategorizedSelected,
    pendingKey,
    isAnyPending,
    creatingMode,
    setCreatingMode,
    newFolderName,
    setNewFolderName,
    isCreating,
    handleSelectUncategorized,
    handleSelectFolder,
    handleCreateAndSelect,
  };
}
