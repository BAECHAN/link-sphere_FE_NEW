import { useQueryClient } from '@tanstack/react-query';
import { Post } from '@/entities/post/model/post.schema';
import { prefetchBookmarkFolderList } from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useAuthStore } from '@/shared/store/auth.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

/**
 * 북마크 버튼 — 폴더 선택 모달의 열림 상태와 목록 프리페치.
 * - 열림 상태는 히스토리 엔트리로 관리한다(useHistoryOverlay) — 모달이 열린 채 뒤로가기를
 *   누르면 이전 페이지로 가지 않고 모달만 닫힌다(docs/DECISIONS.md 2026-08-07 뒤로가기 정책 T1).
 *   피드에는 카드가 여러 장이라 키를 postId마다 따로 둔다 — 공용 키면 모든 카드의 모달이 같이 열린다.
 * - hover/focus 시 폴더 목록을 미리 불러와, 모달이 작게 떴다가 목록이 들어오며 늘어나지 않게 한다.
 *   비로그인이면 401 → 전역 에러 토스트로 이어지므로 로그인 상태에서만 부른다.
 */
export function useBookmarkPostButton(postId: Post['id']) {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guard = useAuthGuard();
  const { isOpen, open, close } = useHistoryOverlay(`bookmarkFolderDialogOpen:${postId}`);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    guard(open, { resumeAfterLogin: true });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      close();
    }
  };

  const handlePrefetch = () => {
    if (!isAuthenticated) {
      return;
    }

    prefetchBookmarkFolderList(queryClient);
  };

  return { isOpen, handleClick, handleOpenChange, handlePrefetch };
}
