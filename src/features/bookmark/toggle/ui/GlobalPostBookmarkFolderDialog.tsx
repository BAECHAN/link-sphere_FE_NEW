import { type ReactNode } from 'react';
import {
  PostCardBookmarkFolderDialog,
  type BookmarkFolderSelectRenderProps,
} from '@/features/bookmark/toggle/ui/PostCardBookmarkFolderDialog';
import { useGlobalPostBookmarkFolderDialog } from '@/features/bookmark/toggle/hooks/useGlobalPostBookmarkFolderDialog';

interface GlobalPostBookmarkFolderDialogProps {
  /** 폴더 선택 창을 그리는 함수 - 위층(PostFolderDialogHost)이 넘긴다 (docs/FE-ARCHITECTURE.md §26) */
  renderFolderSelect: (props: BookmarkFolderSelectRenderProps) => ReactNode;
}

/**
 * 카드의 북마크 버튼이 여는 폴더 선택 창 - RootLayout에 하나만 둔다(GlobalImageViewer와 같은 방식).
 * 카드 안에 두면 북마크 페이지에서 폴더를 빼는 순간 카드와 함께 창이 언마운트돼 딤·시트가 닫힘 애니메이션 없이
 * 사라지고, 요청이 실패해 카드가 돌아오면 창이 새로 열리듯 다시 나타났다(docs/BOOKMARK.md §5).
 * 게시글마다 key로 새로 그린다 - 카드마다 창이 따로 있던 때처럼 뮤테이션·스냅샷이 다른 글로 이어지지 않게 한다.
 */
export function GlobalPostBookmarkFolderDialog({
  renderFolderSelect,
}: GlobalPostBookmarkFolderDialogProps) {
  const { target, isOpen, handleOpenChange } = useGlobalPostBookmarkFolderDialog();

  if (!target) {
    return null;
  }

  return (
    <PostCardBookmarkFolderDialog
      key={target.postId}
      postId={target.postId}
      isBookmarked={target.isBookmarked}
      bookmarkFolderIds={target.bookmarkFolderIds}
      open={isOpen}
      onOpenChange={handleOpenChange}
      renderFolderSelect={renderFolderSelect}
    />
  );
}
