import { type ReactNode } from 'react';
import { TEXTS } from '@/shared/config/texts';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { usePostCardBookmarkFolderDialog } from '@/features/bookmark/toggle/hooks/usePostCardBookmarkFolderDialog';

/**
 * 폴더 선택 창에 넘기는 값. 창 자체(features/bookmark/select의 BookmarkFolderSelectDialog)는
 * 같은 레이어라 직접 import하지 않고 위층(PostCard)이 renderFolderSelect로 넘긴다 — 위층이
 * 이 값을 창에 그대로 넘기므로 모양이 어긋나면 TypeScript가 거기서 잡는다
 * (docs/FE-ARCHITECTURE.md §26).
 */
export interface BookmarkFolderSelectRenderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  isBookmarked: boolean;
  selectedFolderIds: string[];
  onSelectUncategorized: () => void | Promise<void>;
  onSelectFolder: (folder: BookmarkFolder) => void | Promise<void>;
  dangerAction?: { label: string; onClick: () => void | Promise<void> };
}

interface PostCardBookmarkFolderDialogProps {
  postId: string;
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderFolderSelect: (props: BookmarkFolderSelectRenderProps) => ReactNode;
}

/**
 * 북마크 폴더 선택 UI — PostCard(피드·상세·북마크 페이지가 공유하는 위젯)의 북마크
 * 버튼에서 열리는 즉시 저장(탭 = 바로 저장/제거 + 닫힘) 버전. 동작은
 * usePostCardBookmarkFolderDialog가 소유하고, 실제 모달 마크업(행 구성·최근 구획·새 폴더
 * 만들기)은 등록 폼의 PostCreateBookmarkFolderField와 공유하는
 * features/bookmark/select/ui/BookmarkFolderSelectDialog 이 담당한다 — 위층이 renderFolderSelect로 넘긴다.
 */
export function PostCardBookmarkFolderDialog({
  postId,
  isBookmarked,
  bookmarkFolderIds,
  open,
  onOpenChange,
  renderFolderSelect,
}: PostCardBookmarkFolderDialogProps) {
  const { wasBookmarkedOnOpen, handleSelectUncategorized, handleSelectFolder, handleRemove } =
    usePostCardBookmarkFolderDialog({
      postId,
      isBookmarked,
      bookmarkFolderIds,
      open,
      onOpenChange,
    });

  return renderFolderSelect({
    open,
    onOpenChange,
    description: TEXTS.bookmark.folder.selectorDescription,
    isBookmarked,
    selectedFolderIds: bookmarkFolderIds,
    onSelectUncategorized: handleSelectUncategorized,
    onSelectFolder: handleSelectFolder,
    dangerAction: wasBookmarkedOnOpen
      ? { label: TEXTS.bookmark.folder.removeBookmark, onClick: handleRemove }
      : undefined,
  });
}
