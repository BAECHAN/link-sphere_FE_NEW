import { CreatePostForm } from '@/features/post/create/ui/CreatePostForm';
import type { PostCreateFolderSelectRenderProps } from '@/features/post/create/ui/PostCreateBookmarkFolderField';
import { BookmarkFolderSelectDialog } from '@/features/bookmark/select/ui/BookmarkFolderSelectDialog';

// 글쓰기 폼(features/post/create)과 폴더 선택 창(features/bookmark/select)은 같은 레이어라
// 서로 import하지 않는다 — 위층인 페이지가 창을 넘긴다. 모듈 최상단에 둬 렌더마다 같은
// 함수가 넘어가게 한다 (docs/FE-ARCHITECTURE.md §26)
function renderFolderSelect(props: PostCreateFolderSelectRenderProps) {
  return <BookmarkFolderSelectDialog {...props} />;
}

export function PostSubmitPage() {
  return <CreatePostForm renderFolderSelect={renderFolderSelect} />;
}
