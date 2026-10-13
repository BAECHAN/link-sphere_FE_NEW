import type { QueryClient } from '@tanstack/react-query';
import { postInvalidateQueries } from '@/entities/post/@x/bookmark';
import {
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

const rootKey = ['folder'] as const;

export const bookmarkFolderMutationKeys = {
  create: [...rootKey, 'create'] as const,
  update: (folderId: string) => [...rootKey, 'update', folderId] as const,
  delete: (folderId: string) => [...rootKey, 'delete', folderId] as const,
  addBookmarkFolder: (postId: string) => [...rootKey, 'addBookmarkFolder', postId] as const,
  removeBookmarkFolder: (postId: string) => [...rootKey, 'removeBookmarkFolder', postId] as const,
  clearBookmarkFolders: (postId: string) => [...rootKey, 'clearBookmarkFolders', postId] as const,
};

/**
 * 같은 글의 북마크 요청(저장·해제·폴더 추가·제거·비우기)이 함께 서는 줄 — 되돌리기 토스트(8초)가
 * 다이얼로그보다 오래 남아, 되돌리기 요청과 다시 연 다이얼로그의 요청이 겹칠 수 있다. 같은 scope.id는
 * 시작한 순서대로 하나씩 나가 클릭 순서대로 서버에 닿는다(docs/plans/2026-10-13-bookmark-set-state.md).
 */
export const bookmarkPostScope = (postId: string) => ({ id: `bookmark:${postId}` });

/**
 * 같은 글의 북마크 요청 중 지금 끝나는 것이 마지막인가 — onSuccess·onError 시점엔 자기 자신도
 * pending이라 1이면 남은 요청이 없다. 여러 mutation이 한 scope를 공유해 mutationKey 대신 scope로 센다.
 */
export const isLastPendingBookmarkMutation = (queryClient: QueryClient, postId: string) => {
  const scopeId = bookmarkPostScope(postId).id;

  return (
    queryClient.isMutating({ predicate: (mutation) => mutation.options.scope?.id === scopeId }) ===
    1
  );
};

export const bookmarkFolderKeys = {
  root: rootKey,
  list: [...rootKey, 'list'] as const,
  postsRoot: [...rootKey, 'posts'] as const,
  posts: (folderKey: BookmarkFolderKey, sort?: BookmarkFolderSort, search?: string) =>
    [...rootKey, 'posts', folderKey, sort ?? 'latest', search ?? ''] as const,
};

export const bookmarkFolderInvalidateQueries = {
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: bookmarkFolderKeys.list });
  },
  postsRoot: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: bookmarkFolderKeys.postsRoot });
  },
  posts: (queryClient: QueryClient, folderKey: BookmarkFolderKey) => {
    queryClient.invalidateQueries({ queryKey: [...bookmarkFolderKeys.postsRoot, folderKey] });
  },
};

/** 폴더 생성 후 — 목록만 갱신 (post 변화 없음) */
export const handleBookmarkFolderCreateSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
};

/** 폴더 이름 수정 후 — 목록만 갱신 */
export const handleBookmarkFolderUpdateSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
};

/**
 * 폴더 삭제 후 — 폴더 목록 + 모든 폴더별 게시글 + post 목록(그 폴더가 소속에서 빠지므로) 갱신
 */
export const handleBookmarkFolderDeleteSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
  postInvalidateQueries.list(queryClient);
};

/**
 * 북마크가 생기거나 없어진 뒤(저장·해제 PUT/DELETE, 북마크와 함께 글 작성) — 폴더 목록(bookmarkCount) +
 * 모든 폴더별 게시글(totalElements) 재검증
 */
export const handleBookmarkToggleSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
};

/**
 * 게시글 삭제 후 — 폴더 목록(bookmarkCount) + 모든 폴더별 게시글(목록에서 제거) 재검증
 * (post 목록은 삭제 mutation의 optimistic update로 이미 반영됨)
 */
export const handlePostDeleteSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
};

/**
 * 게시글 내용 수정 후 — 폴더별 게시글 목록 갱신 (제목·설명·이미지·카테고리·공개설정이 바뀜)
 * 북마크 개수는 변하지 않으므로 폴더 목록(list)은 건드리지 않는다.
 */
export const handlePostContentUpdateSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
};

/**
 * 폴더 소속 변경(추가/제거/전체해제) 후 — 폴더 목록(bookmarkCount 변경) + 모든 폴더별 게시글 + post 목록/detail 갱신.
 * postsRoot 무효화가 새로 소속된 폴더 목록에 카드가 등장하는 걸 처리하므로, 낙관적 레이어는 삽입을 시도하지 않는다.
 */
export const handleBookmarkFolderChangeSuccess = (queryClient: QueryClient, postId: string) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
  bookmarkFolderInvalidateQueries.postsRoot(queryClient);
  postInvalidateQueries.detail(queryClient, postId);
  postInvalidateQueries.list(queryClient);
};
