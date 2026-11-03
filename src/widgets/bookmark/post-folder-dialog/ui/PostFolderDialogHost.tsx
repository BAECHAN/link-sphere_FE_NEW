import type { BookmarkFolderSelectRenderProps } from '@/features/bookmark/toggle/ui/PostCardBookmarkFolderDialog';
import { GlobalPostBookmarkFolderDialog } from '@/features/bookmark/toggle/ui/GlobalPostBookmarkFolderDialog';
import { BookmarkFolderSelectDialog } from '@/features/bookmark/select/ui/BookmarkFolderSelectDialog';

// 북마크 버튼 쪽(features/bookmark/toggle)과 폴더 선택 창(features/bookmark/select)은 같은
// 레이어라 서로 import하지 않는다 — 위층인 여기서 창을 넘긴다. 모듈 최상단에 둬 렌더마다
// 같은 함수가 넘어가게 한다 (docs/FE-ARCHITECTURE.md §26)
function renderBookmarkFolderSelect(props: BookmarkFolderSelectRenderProps) {
  return <BookmarkFolderSelectDialog {...props} />;
}

/**
 * 카드 북마크 버튼이 여는 폴더 선택 창의 호스트 - RootLayout이 lazy로 하나만 둔다.
 * 창 코드를 진입 청크에서 떼는 경계이기도 하다(LoginDialog와 같은 방식).
 */
export function PostFolderDialogHost() {
  return <GlobalPostBookmarkFolderDialog renderFolderSelect={renderBookmarkFolderSelect} />;
}
