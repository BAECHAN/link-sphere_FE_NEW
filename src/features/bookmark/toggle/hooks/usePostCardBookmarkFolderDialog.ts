import { useState } from 'react';
import { useNavigate, type Location } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { ErrorUtil } from '@/shared/utils/error.util';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { UNDO_TOAST_DURATION_MS } from '@/shared/config/const';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { ApiError } from '@/shared/types/common.type';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useBookmarkFolders } from '@/features/bookmark/toggle/hooks/useBookmarkFolders';
import { POST_BOOKMARK_FOLDER_DIALOG_KEY } from '@/features/bookmark/toggle/hooks/postBookmarkFolderDialog.store';

function isBookmarkLimitExceeded(error: unknown) {
  return error instanceof ApiError && error.code === SERVER_ERROR_CODE.BOOKMARK_LIMIT_EXCEEDED;
}

// 지금 히스토리 칸이 이 창을 연 칸인지 - 라우터가 가 있는 위치로 본다(useBackClosableOverlay.ts와 같은 출처)
function isOnDialogEntry(location: Location | null) {
  return Boolean(
    (location?.state as Record<string, boolean> | null)?.[POST_BOOKMARK_FOLDER_DIALOG_KEY]
  );
}

interface UsePostCardBookmarkFolderDialogParams {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * PostCardBookmarkFolderDialog의 로직 전부 — 즉시 저장(탭 = 바로 저장/제거 + 닫힘) 동작,
 * 토스트 문구 분기, '삭제하기' 버튼 깜빡임 방지 스냅샷을 소유한다. entities 뮤테이션을
 * 감싸는 useBookmarkFolders와는 층이 다르다 — 이 훅이 그걸 호출해 토스트·닫기 같은
 * 모달 UI의 관심사를 덧붙인다.
 */
export function usePostCardBookmarkFolderDialog({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
}: UsePostCardBookmarkFolderDialogParams) {
  const navigate = useNavigate();
  const { selectUncategorized, selectFolder, restoreFolder, removeBookmark, restoreBookmark } =
    useBookmarkFolders(postId, isBookmarked, bookmarkFolderIds);

  // 모달을 연 시점의 북마크 여부를 고정한다. 저장 중 낙관적 갱신으로 isBookmarked가
  // true로 바뀌어도, 닫힘 애니메이션 동안 '삭제하기' 버튼이 깜빡이지 않도록 방지한다.
  const [wasBookmarkedOnOpen, setWasBookmarkedOnOpen] = useState(isBookmarked);
  const [prevOpen, setPrevOpen] = useState(open);

  // open 이 true 로 전환되는 순간에만 스냅샷 — 저장 중 isBookmarked 변화는 의도적으로 무시.
  // effect가 아니라 렌더 중에 맞춘다 (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (open !== prevOpen) {
    setPrevOpen(open);

    if (open) {
      setWasBookmarkedOnOpen(isBookmarked);
    }
  }

  // 저장 결과를 바로 확인할 수 있게 저장된 폴더로 데려간다. 버튼 자리와 닫기 X 유무는 래퍼가 정한다
  // (shared/lib/toast/toast-layout.ts - 한 줄 문구라 버튼은 같은 줄 오른쪽, X는 없다)
  const viewSavedOptions = (folderKey: string) => ({
    action: {
      label: TEXTS.bookmark.folder.viewAction,
      onClick: () => navigate(`${ROUTES_PATHS.BOOKMARK}?folder=${folderKey}`),
    },
  });

  // 한도 안내의 "북마크 보기" - 정리하러 북마크함 전체로 보낸다. 창이 열린 칸에서 떠날 때는 그 칸을 교체한다 -
  // 남기면 뒤로 왔을 때 창이 다시 열린다(docs/BACK-NAVIGATION.md "새 오버레이를 만들 때" 5). 이미 북마크함
  // 전체에 있으면 이동하지 않고 창만 닫는다 - 교체하면 같은 화면이 두 칸 남는다(Sidebar.tsx useDrawerLink와 같은 방식)
  const goToBookmarks = () => {
    const location = RouterEvents.getLocation();
    const onDialogEntry = isOnDialogEntry(location);
    const isAlreadyThere =
      location !== null && `${location.pathname}${location.search}` === ROUTES_PATHS.BOOKMARK;

    if (isAlreadyThere) {
      if (onDialogEntry) {
        onOpenChange(false);
      }

      return;
    }

    navigate(ROUTES_PATHS.BOOKMARK, { replace: onDialogEntry });
  };

  /**
   * 북마크가 새로 생기는 요청(저장·폴더 담기·되돌리기)의 실패 토스트. 회원당 저장 한도(409 BOOKMARK_LIMIT_EXCEEDED)로
   * 거절됐으면 일반 실패 문구 대신 한도와 해결 방법을 알리고 북마크함으로 가는 버튼을 단다 - 다시 눌러도 같은
   * 결과라 이유와 갈 곳을 모르면 벗어날 방법이 없다. 그 밖의 실패는 지금까지와 같다. persistent는 닫을 때까지
   * 남기는 토스트(되돌리기 실패)의 옵션이다 - 그때는 닫기 버튼을 끄지 않는다(끄면 닫을 방법이 버튼뿐이다).
   */
  const toastSaveFailure = (
    error: unknown,
    failedMessage: string,
    persistent?: { id: string; duration: number }
  ) => {
    if (isBookmarkLimitExceeded(error)) {
      const action = { label: TEXTS.bookmark.folder.viewBookmarksAction, onClick: goToBookmarks };

      // 두 문장 문구라 래퍼가 버튼을 문구 아래 줄 오른쪽에, 닫기 X를 오른쪽 위에 둔다(shared/lib/toast/toast-layout.ts)
      toast.error(TEXTS.messages.error.bookmarkLimitExceeded, { ...persistent, action });

      return;
    }

    const message = ErrorUtil.resolveFailureMessage(error, failedMessage);

    if (persistent) {
      toast.error(message, persistent);
    } else {
      toast.error(message);
    }
  };

  // 파괴적 조작(북마크 완전 삭제) 뒤에 붙이는 되돌리기 액션 — mutateAsync를 직접 호출해
  // 컴포넌트 마운트 상태와 무관하게 동작하고, 실패는 별도 에러 토스트로만 알린다
  // (entities 레이어의 meta.manualErrorHandling과 같은 이유로 여기서 직접 처리).
  const undoOptions = (onUndo: () => Promise<unknown>) => ({
    action: {
      label: TEXTS.bookmark.folder.undoAction,
      onClick: () => {
        onUndo().catch((error: unknown) => {
          // 로그인 만료로 끝났으면 안내는 만료 정리가 맡는다(ErrorUtil.isSessionExpired)
          if (ErrorUtil.isSessionExpired(error)) {
            return;
          }

          // 되돌리기 토스트는 누르는 순간 닫히고 화면은 되돌리기 전과 같아진다 - 이 토스트가 유일한 안내라
          // 닫을 때까지 남기고, 같은 id로 쌓이지 않게 한다(docs/FE-ARCHITECTURE.md §14)
          toastSaveFailure(error, TEXTS.messages.error.bookmarkRestoreFailed, {
            id: 'bookmark-restore-error',
            duration: Infinity,
          });
        });
      },
    },
    duration: UNDO_TOAST_DURATION_MS,
  });

  // 응답 뒤에는 요청을 보낸 창이 아직 떠 있을 때만 닫는다. 기다리는 동안 뒤로가기로 닫고 다시 열면 히스토리 칸이
  // 새로 생겨 위치 객체가 바뀐다 - 그 창은 이 응답과 무관하니 닫지 않는다(#513). 위치는 라우터가 가 있는 곳에서
  // 읽는다(useBackClosableOverlay.ts와 같은 출처)
  const closeIfStillOn = (requestEntry: Location | null) => {
    if (RouterEvents.getLocation() !== requestEntry) {
      return;
    }

    onOpenChange(false);
  };

  const handleSelectUncategorized = async () => {
    // 이미 미분류(✓)면 폴더 행의 "마지막 폴더 탭"과 같은 파괴적 조작이다 — 북마크 자체를
    // 완전 삭제한다. handleRemove가 되돌리기 토스트·에러 처리·모달 닫기를 이미 갖고
    // 있으므로 그대로 위임한다(2026-09-11 변경, docs/DECISIONS.md).
    const isAlreadyUncategorized = isBookmarked && bookmarkFolderIds.length === 0;

    if (isAlreadyUncategorized) {
      await handleRemove();
      return;
    }

    // 이미 1개 이상의 폴더에 소속돼 있었다면 이번 탭은 "전체 해제" — 폴더 하나가 아니라
    // 여러 폴더에서 한꺼번에 빠졌다는 걸 알려야 하므로 일반 저장 문구와 구분한다.
    const wasInFolders = isBookmarked && bookmarkFolderIds.length > 0;
    const requestEntry = RouterEvents.getLocation();

    try {
      const saved = await selectUncategorized();
      // 낡은 화면에서 저장했는데 서버엔 이미 폴더 소속이 있었다면 저장은 그 소속을 유지한다 —
      // 미분류에 저장된 게 아니므로 그 사실을 알리고, 어느 폴더인지는 전체 목록에서 보게 한다
      const isInOtherFolders = !wasInFolders && saved.folderIds.length > 0;

      if (wasInFolders) {
        toast.success(
          TEXTS.messages.success.bookmarkClearedAllFolders,
          viewSavedOptions('uncategorized')
        );
      } else if (isInOtherFolders) {
        toast.success(
          TEXTS.messages.success.bookmarkAlreadyInOtherFolders,
          viewSavedOptions('all')
        );
      } else {
        toast.success(
          TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized),
          viewSavedOptions('uncategorized')
        );
      }

      closeIfStillOn(requestEntry);
    } catch (error) {
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      toastSaveFailure(error, TEXTS.messages.error.bookmarkSaveFailed);
    }
  };

  const handleSelectFolder = async (folder: BookmarkFolder) => {
    const wasSelected = bookmarkFolderIds.includes(folder.id);
    // 이게 마지막 폴더였다면 미분류로 남기지 않고 북마크 자체를 완전 삭제한다
    // (2026-09-11 변경 — useBookmarkFolders.selectFolder가 이미 마지막 폴더 해제로
    // 분기해뒀다). 되돌리기는 같은 폴더로 addBookmarkFolder를 다시 호출하는 것과
    // 정확히 같아서(멱등) 안전하게 원복된다.
    const isLastFolder = wasSelected && bookmarkFolderIds.length === 1;
    const requestEntry = RouterEvents.getLocation();

    try {
      const result = await selectFolder(folder.id);
      // 화면상 마지막이었어도 다른 기기가 추가한 소속이 남아 있으면 서버가 북마크를 지킨다 —
      // 실제 결과는 "그 폴더에서만 빠짐"이라 일반 제거 토스트를 띄운다
      const removedBookmark = isLastFolder && !result.isBookmarked;

      if (removedBookmark) {
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
      closeIfStillOn(requestEntry);
    } catch (error) {
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      if (isLastFolder) {
        toast.error(
          ErrorUtil.resolveFailureMessage(error, TEXTS.messages.error.bookmarkRemoveFailed)
        );
      } else {
        if (wasSelected) {
          toast.error(
            ErrorUtil.resolveFailureMessage(
              error,
              TEXTS.messages.error.bookmarkRemoveFromFolderFailed
            )
          );
        } else {
          toastSaveFailure(error, TEXTS.messages.error.bookmarkSaveFailed);
        }
      }
    }
  };

  const handleRemove = async () => {
    // 되돌리기 대상(prevFolderIds)은 삭제 전 소속을 그대로 캡처해둔다 — 소속이 여럿이면
    // 일괄 복원 UX(순서·부분 실패 처리)가 별도로 필요해 범위 밖으로 미루고, 0~1개일
    // 때만 되돌리기를 제공한다.
    const prevFolderIds = bookmarkFolderIds;
    const requestEntry = RouterEvents.getLocation();

    try {
      await removeBookmark();
      if (prevFolderIds.length <= 1) {
        toast.success(TEXTS.messages.success.bookmarkRemoved, {
          ...undoOptions(() => restoreBookmark(prevFolderIds)),
        });
      } else {
        toast.success(TEXTS.messages.success.bookmarkRemoved);
      }
      closeIfStillOn(requestEntry);
    } catch (error) {
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      toast.error(
        ErrorUtil.resolveFailureMessage(error, TEXTS.messages.error.bookmarkRemoveFailed)
      );
    }
  };

  return {
    wasBookmarkedOnOpen,
    handleSelectUncategorized,
    handleSelectFolder,
    handleRemove,
  };
}
