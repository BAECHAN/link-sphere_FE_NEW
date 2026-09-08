import type { QueryClient } from '@tanstack/react-query';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';
import {
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

const rootKey = ['folder'] as const;

export const bookmarkFolderMutationKeys = {
  create: [...rootKey, 'create'] as const,
  update: (folderId: string) => [...rootKey, 'update', folderId] as const,
  delete: (folderId: string) => [...rootKey, 'delete', folderId] as const,
  reorder: [...rootKey, 'reorder'] as const,
  addBookmarkFolder: (postId: string) => [...rootKey, 'addBookmarkFolder', postId] as const,
  removeBookmarkFolder: (postId: string) => [...rootKey, 'removeBookmarkFolder', postId] as const,
  clearBookmarkFolders: (postId: string) => [...rootKey, 'clearBookmarkFolders', postId] as const,
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

/** 폴더 순서 변경 — 목록만 갱신 */
export const handleBookmarkFolderReorderSuccess = (queryClient: QueryClient) => {
  bookmarkFolderInvalidateQueries.list(queryClient);
};

/**
 * 북마크 토글(추가/제거) 후 — 폴더 목록(bookmarkCount) + 모든 폴더별 게시글(totalElements) 재검증
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
