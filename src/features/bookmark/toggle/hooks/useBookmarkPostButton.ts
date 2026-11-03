import { useLayoutEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchBookmarkFolderList } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useAuthStore } from '@/shared/store/auth.store';
import { useBackClosableOverlayOpen } from '@/shared/hooks/useBackClosableOverlay';
import {
  POST_BOOKMARK_FOLDER_DIALOG_KEY,
  usePostBookmarkFolderDialogStore,
  type PostBookmarkFolderDialogTarget,
} from '@/features/bookmark/toggle/hooks/postBookmarkFolderDialog.store';

/**
 * 북마크 버튼 — 폴더 선택 창 열기와 목록 프리페치.
 * - 창은 카드 안이 아니라 RootLayout의 호스트(GlobalPostBookmarkFolderDialog) 하나가 그린다. 카드가 목록에서
 *   빠져도(북마크 페이지에서 폴더 빼기) 창이 닫힘 애니메이션을 끝까지 하고, 요청이 실패하면 열린 채 남는다
 *   (docs/BOOKMARK.md §5). 버튼은 열 대상을 스토어에 넣고 열기만 한다 - 열림 구독·뒤로가기 처리는 호스트가 맡는다.
 * - 이 카드가 대상이면(닫혀도 대상은 남는다) 최신 북마크 상태를 스토어에 넣는다(칠하기 전에 반영되게 layout effect).
 *   로그인 뒤 재개는 클릭 시점 값으로 열리므로, 대상이 되는 순간에도 한 번 맞춘다.
 * - hover/focus 시 폴더 목록을 미리 불러와, 모달이 작게 떴다가 목록이 들어오며 늘어나지 않게 한다.
 *   비로그인이면 401이 clearAll + 로그인 화면 이동으로 이어지므로(client.ts:440-443) 로그인 상태에서만 부른다.
 */
export function useBookmarkPostButton({
  postId,
  isBookmarked,
  bookmarkFolderIds,
}: PostBookmarkFolderDialogTarget) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guard = useAuthGuard();
  const openOverlay = useBackClosableOverlayOpen(POST_BOOKMARK_FOLDER_DIALOG_KEY);
  const setTarget = usePostBookmarkFolderDialogStore((state) => state.setTarget);
  const syncTarget = usePostBookmarkFolderDialogStore((state) => state.syncTarget);
  const isTarget = usePostBookmarkFolderDialogStore((state) => state.target?.postId === postId);

  useLayoutEffect(
    function syncLatestStateToDialog() {
      if (!isTarget) {
        return;
      }

      syncTarget({ postId, isBookmarked, bookmarkFolderIds });
    },
    [isTarget, postId, isBookmarked, bookmarkFolderIds, syncTarget]
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    guard(
      () => {
        setTarget({ postId, isBookmarked, bookmarkFolderIds });
        openOverlay();
      },
      { resumeAfterLogin: true }
    );
  };

  const handlePrefetch = () => {
    if (!isAuthenticated) {
      return;
    }

    prefetchBookmarkFolderList(queryClient);
  };

  return { handleClick, handlePrefetch };
}
