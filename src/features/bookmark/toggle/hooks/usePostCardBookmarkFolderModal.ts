import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { UNDO_TOAST_DURATION_MS } from '@/shared/config/const';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useBookmarkFolders } from '@/features/bookmark/toggle/hooks/useBookmarkFolders';

interface UsePostCardBookmarkFolderModalParams {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * PostCardBookmarkFolderModal의 로직 전부 — 즉시 저장(탭 = 바로 저장/제거 + 닫힘) 동작,
 * 토스트 문구 분기, '삭제하기' 버튼 깜빡임 방지 스냅샷을 소유한다. entities 뮤테이션을
 * 감싸는 useBookmarkFolders와는 층이 다르다 — 이 훅이 그걸 호출해 토스트·닫기 같은
 * 모달 UI의 관심사를 덧붙인다.
 */
export function usePostCardBookmarkFolderModal({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
}: UsePostCardBookmarkFolderModalParams) {
  const navigate = useNavigate();
  const { selectUncategorized, selectFolder, restoreFolder, removeBookmark, restoreBookmark } =
    useBookmarkFolders(postId, isBookmarked, bookmarkFolderIds);

  // 모달을 연 시점의 북마크 여부를 고정한다. 저장 중 낙관적 갱신으로 isBookmarked가
  // true로 바뀌어도, 닫힘 애니메이션 동안 '삭제하기' 버튼이 깜빡이지 않도록 방지한다.
  const [wasBookmarkedOnOpen, setWasBookmarkedOnOpen] = useState(isBookmarked);
  useEffect(
    function snapshotBookmarkStateOnOpen() {
      if (open) {
        setWasBookmarkedOnOpen(isBookmarked);
      }
      // open 이 true 로 전환되는 순간에만 스냅샷 — 저장 중 isBookmarked 변화는 의도적으로 무시
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  // 저장 결과를 바로 확인할 수 있게 저장된 폴더로 데려간다. 액션과 닫기 버튼이 자리를 다투므로
  // FCM 알림 토스트와 동일하게 액션이 있을 때는 닫기 버튼을 끈다.
  const viewSavedOptions = (folderKey: string) => ({
    action: {
      label: TEXTS.bookmark.folder.viewAction,
      onClick: () => navigate(`${ROUTES_PATHS.BOOKMARK}?folder=${folderKey}`),
    },
    closeButton: false,
  });

  // 파괴적 조작(북마크 완전 삭제) 뒤에 붙이는 되돌리기 액션 — mutateAsync를 직접 호출해
  // 컴포넌트 마운트 상태와 무관하게 동작하고, 실패는 별도 에러 토스트로만 알린다
  // (entities 레이어의 meta.manualErrorHandling과 같은 이유로 여기서 직접 처리).
  const undoOptions = (onUndo: () => Promise<unknown>) => ({
    action: {
      label: TEXTS.bookmark.folder.undoAction,
      onClick: () => {
        onUndo().catch(() => {
          toast.error(TEXTS.messages.error.bookmarkRestoreFailed);
        });
      },
    },
    closeButton: false,
    duration: UNDO_TOAST_DURATION_MS,
  });

  const handleSelectUncategorized = async () => {
    // 이미 1개 이상의 폴더에 소속돼 있었다면 이번 탭은 "전체 해제" — 폴더 하나가 아니라
    // 여러 폴더에서 한꺼번에 빠졌다는 걸 알려야 하므로 일반 저장 문구와 구분한다.
    const wasInFolders = isBookmarked && bookmarkFolderIds.length > 0;

    try {
      await selectUncategorized();
      toast.success(
        wasInFolders
          ? TEXTS.messages.success.bookmarkClearedAllFolders
          : TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized),
        viewSavedOptions('uncategorized')
      );
      onOpenChange(false);
    } catch {
      toast.error(TEXTS.messages.error.bookmarkSaveFailed);
    }
  };

  const handleSelectFolder = async (folder: BookmarkFolder) => {
    const wasSelected = bookmarkFolderIds.includes(folder.id);
    // 이게 마지막 폴더였다면 미분류로 남기지 않고 북마크 자체를 완전 삭제한다
    // (2026-09-11 변경 — useBookmarkFolders.selectFolder가 이미 toggleBookmark로
    // 분기해뒀다). 되돌리기는 같은 폴더로 addBookmarkFolder를 다시 호출하는 것과
    // 정확히 같아서(멱등) 안전하게 원복된다.
    const isLastFolder = wasSelected && bookmarkFolderIds.length === 1;

    try {
      await selectFolder(folder.id);
      if (isLastFolder) {
        toast.success(TEXTS.messages.success.bookmarkRemovedFromFolder(folder.name), {
          description: TEXTS.messages.success.bookmarkRemovedWithLastFolderDescription,
          ...undoOptions(() => restoreFolder(folder.id)),
        });
      } else if (wasSelected) {
        toast.success(TEXTS.messages.success.bookmarkRemovedFromFolder(folder.name));
      } else {
        toast.success(
          TEXTS.messages.success.bookmarkSavedTo(folder.name),
          viewSavedOptions(folder.id)
        );
      }
      onOpenChange(false);
    } catch {
      if (isLastFolder) {
        toast.error(TEXTS.messages.error.bookmarkRemoveFailed);
      } else {
        toast.error(
          wasSelected
            ? TEXTS.messages.error.bookmarkRemoveFromFolderFailed
            : TEXTS.messages.error.bookmarkSaveFailed
        );
      }
    }
  };

  const handleRemove = async () => {
    // 되돌리기 대상(prevFolderIds)은 삭제 전 소속을 그대로 캡처해둔다 — 소속이 여럿이면
    // 일괄 복원 UX(순서·부분 실패 처리)가 별도로 필요해 범위 밖으로 미루고, 0~1개일
    // 때만 되돌리기를 제공한다.
    const prevFolderIds = bookmarkFolderIds;

    try {
      await removeBookmark();
      if (prevFolderIds.length <= 1) {
        toast.success(TEXTS.messages.success.bookmarkRemoved, {
          ...undoOptions(() => restoreBookmark(prevFolderIds)),
        });
      } else {
        toast.success(TEXTS.messages.success.bookmarkRemoved);
      }
      onOpenChange(false);
    } catch {
      toast.error(TEXTS.messages.error.bookmarkRemoveFailed);
    }
  };

  return {
    wasBookmarkedOnOpen,
    handleSelectUncategorized,
    handleSelectFolder,
    handleRemove,
  };
}
