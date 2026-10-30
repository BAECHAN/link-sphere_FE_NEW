import { specClient } from '@/shared/api/spec-client';
import { PostListRequest, PostListResponse } from '@/entities/post/@x/bookmark';
import {
  BookmarkFolder,
  BookmarkFolderKey,
  BookmarkFolderListResponse,
  BookmarkFolderPinResponse,
  BookmarkFolderSort,
  BookmarkFoldersResponse,
  CreateBookmarkFolderRequest,
  UpdateBookmarkFolderRequest,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

export const bookmarkFolderApi = {
  /** 내 폴더 목록 (bookmarkCount 포함, sortOrder ASC) + 미분류 개수 */
  fetchBookmarkFolderList: async (): Promise<BookmarkFolderListResponse> => {
    return await specClient.get('/bookmark/folders');
  },

  /** 폴더 생성 — sort_order = max+1 */
  createBookmarkFolder: async (payload: CreateBookmarkFolderRequest): Promise<BookmarkFolder> => {
    return await specClient.post('/bookmark/folders', { body: payload });
  },

  /** 폴더 이름 수정 */
  updateBookmarkFolder: async (
    folderId: string,
    payload: UpdateBookmarkFolderRequest
  ): Promise<BookmarkFolder> => {
    return await specClient.patch('/bookmark/folders/{folderId}', {
      path: { folderId },
      body: payload,
    });
  },

  /** 폴더 삭제 — 이 폴더에만 있던 북마크만 미분류로 이동 (다른 폴더에도 있으면 그대로 유지) */
  deleteBookmarkFolder: async (folderId: string): Promise<void> => {
    return await specClient.delete('/bookmark/folders/{folderId}', { path: { folderId } });
  },

  /** 폴더 고정 — 이미 고정이면 처음 고정한 시각을 그대로 둔다(멱등). 본문은 없다 */
  pinBookmarkFolder: async (folderId: string): Promise<BookmarkFolderPinResponse> => {
    return await specClient.put('/bookmark/folders/{folderId}/pin', { path: { folderId } });
  },

  /** 폴더 고정 해제 — 고정 안 된 폴더여도 200(멱등) */
  unpinBookmarkFolder: async (folderId: string): Promise<BookmarkFolderPinResponse> => {
    return await specClient.delete('/bookmark/folders/{folderId}/pin', { path: { folderId } });
  },

  /** 폴더별 게시글 조회 — folderKey: 'all' | 'uncategorized' | UUID */
  fetchBookmarkFolderPosts: async (
    folderKey: BookmarkFolderKey,
    payload: PostListRequest & { sort?: BookmarkFolderSort; search?: string }
  ): Promise<PostListResponse> => {
    const { page, size, sort, search } = payload;
    return await specClient.get('/bookmark/folders/{folderKey}/posts', {
      path: { folderKey },
      query: { page, size, ...(sort && { sort }), ...(search && { search }) },
    });
  },

  /** 폴더에 추가 — 북마크가 없으면 자동 생성 (북마크 보장 + 소속 보장) */
  addBookmarkFolder: async (postId: string, folderId: string): Promise<BookmarkFoldersResponse> => {
    return await specClient.post('/bookmark/{postId}/folders/{folderId}', {
      path: { postId, folderId },
    });
  },

  /** 그 폴더에서만 제거 — 북마크 자체는 유지 (마지막 폴더였어도 미분류로 생존) */
  removeBookmarkFolder: async (
    postId: string,
    folderId: string
  ): Promise<BookmarkFoldersResponse> => {
    return await specClient.delete('/bookmark/{postId}/folders/{folderId}', {
      path: { postId, folderId },
    });
  },

  /** 폴더 소속 전부 해제 — 미분류로. 북마크 자체는 건드리지 않음 */
  clearBookmarkFolders: async (postId: string): Promise<BookmarkFoldersResponse> => {
    return await specClient.delete('/bookmark/{postId}/folders', { path: { postId } });
  },
};
