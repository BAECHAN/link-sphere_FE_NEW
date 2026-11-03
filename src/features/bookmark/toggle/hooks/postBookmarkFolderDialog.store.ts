import { create } from 'zustand';
import type { Post } from '@/entities/post/model/post.schema';

/** 북마크 폴더 선택 창의 열림 키. 카드의 버튼(열기)과 RootLayout의 호스트(그리기·닫기)가 같은 키를 쓴다 */
export const POST_BOOKMARK_FOLDER_DIALOG_KEY = 'bookmarkFolderDialogOpen';

/** 창을 연 게시글과 그 북마크 상태 - 카드가 넘기던 props와 같은 모양이다 */
export interface PostBookmarkFolderDialogTarget {
  postId: Post['id'];
  isBookmarked: boolean;
  bookmarkFolderIds: string[];
}

interface PostBookmarkFolderDialogState {
  /**
   * 닫혀도 비우지 않는다 - 닫힘 애니메이션 도중 내용이 사라져 깜빡이지 않게 한다(imageViewer.store.ts와 같은 이유).
   * 카드가 목록에서 빠진 뒤에도(북마크 페이지에서 폴더 빼기) 창은 이 값으로 끝까지 그려진다.
   */
  target: PostBookmarkFolderDialogTarget | null;
  setTarget: (target: PostBookmarkFolderDialogTarget) => void;
  /** 열린 대상 카드가 최신 북마크 상태를 넣는다. 다른 게시글이면 무시하고, 값이 같으면 갱신하지 않는다 */
  syncTarget: (next: PostBookmarkFolderDialogTarget) => void;
}

function isSameTarget(a: PostBookmarkFolderDialogTarget, b: PostBookmarkFolderDialogTarget) {
  return (
    a.postId === b.postId &&
    a.isBookmarked === b.isBookmarked &&
    a.bookmarkFolderIds.length === b.bookmarkFolderIds.length &&
    a.bookmarkFolderIds.every((id, index) => id === b.bookmarkFolderIds[index])
  );
}

export const usePostBookmarkFolderDialogStore = create<PostBookmarkFolderDialogState>()(
  (set, get) => ({
    target: null,
    setTarget: (target) => set({ target }),
    syncTarget: (next) => {
      const { target } = get();

      if (!target || target.postId !== next.postId || isSameTarget(target, next)) {
        return;
      }

      set({ target: next });
    },
  })
);
