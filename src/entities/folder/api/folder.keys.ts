import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';
import { FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';

const rootKey = ['folder'] as const;

export const folderMutationKeys = {
  create: [...rootKey, 'create'] as const,
  update: (folderId: string) => [...rootKey, 'update', folderId] as const,
  delete: (folderId: string) => [...rootKey, 'delete', folderId] as const,
  reorder: [...rootKey, 'reorder'] as const,
  moveBookmark: (postId: string) => [...rootKey, 'moveBookmark', postId] as const,
};

export const folderKeys = {
  root: rootKey,
  list: [...rootKey, 'list'] as const,
  postsRoot: [...rootKey, 'posts'] as const,
  posts: (folderKey: FolderKey, sort?: FolderSort, search?: string) =>
    [...rootKey, 'posts', folderKey, sort ?? 'latest', search ?? ''] as const,
};

export const folderInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  list: () => {
    queryClient.invalidateQueries({ queryKey: folderKeys.list });
  },
  postsRoot: () => {
    queryClient.invalidateQueries({ queryKey: folderKeys.postsRoot });
  },
  posts: (folderKey: FolderKey) => {
    queryClient.invalidateQueries({ queryKey: [...folderKeys.postsRoot, folderKey] });
  },
};

/** 폴더 생성 후 — 목록만 갱신 (post 변화 없음) */
export const handleFolderCreateSuccess = () => {
  folderInvalidateQueries.list();
};

/** 폴더 이름 수정 후 — 목록만 갱신 */
export const handleFolderUpdateSuccess = () => {
  folderInvalidateQueries.list();
};

/**
 * 폴더 삭제 후 — 폴더 목록 + 모든 폴더별 게시글 + post 목록(bookmarkFolderId가 null로 바뀌므로) 갱신
 */
export const handleFolderDeleteSuccess = () => {
  folderInvalidateQueries.list();
  folderInvalidateQueries.postsRoot();
  postInvalidateQueries.list();
};

/** 폴더 순서 변경 — 목록만 갱신 */
export const handleFolderReorderSuccess = () => {
  folderInvalidateQueries.list();
};

/**
 * 북마크 폴더 이동 후 — 폴더 목록(bookmarkCount 변경) + 모든 폴더별 게시글 + post 목록/detail 갱신
 */
export const handleMoveBookmarkSuccess = (postId: string) => {
  folderInvalidateQueries.list();
  folderInvalidateQueries.postsRoot();
  postInvalidateQueries.detail(postId);
  postInvalidateQueries.list();
};
