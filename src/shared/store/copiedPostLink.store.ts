import { create } from 'zustand';

/** 글 카드의 공유 버튼으로 복사한 글의 링크 */
export interface CopiedPostLink {
  postId: string;
  url: string;
  title: string;
}

interface CopiedPostLinkState {
  /**
   * 이 탭에서 마지막으로 복사한 공개 글의 링크. 다른 글의 댓글 입력칸이 "링크 넣기"로 제안한다(docs/COMMENT.md §5).
   * 탭 메모리에만 두고 브라우저 저장소에는 쓰지 않는다 - 새로고침하거나 탭을 닫으면 사라진다.
   */
  copiedPostLink: CopiedPostLink | null;
  rememberCopiedPostLink: (copiedPostLink: CopiedPostLink) => void;
  clearCopiedPostLink: () => void;
}

export const useCopiedPostLinkStore = create<CopiedPostLinkState>()((set) => ({
  copiedPostLink: null,
  rememberCopiedPostLink: (copiedPostLink) => set({ copiedPostLink }),
  clearCopiedPostLink: () => set({ copiedPostLink: null }),
}));
