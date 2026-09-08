import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { PostListRequest, PostListResponse } from '@/entities/post/model/post.schema';
import {
  BookmarkFolder,
  BookmarkFolderKey,
  BookmarkFolderListResponse,
  BookmarkFolderSort,
  BookmarkFoldersResponse,
  CreateBookmarkFolderRequest,
  ReorderBookmarkFoldersRequest,
  UpdateBookmarkFolderRequest,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

export const bookmarkFolderApi = {
  /** 내 폴더 목록 (bookmarkCount 포함, sortOrder ASC) + 미분류 개수 */
  fetchBookmarkFolderList: async (): Promise<BookmarkFolderListResponse> => {
    return await apiClient.get<BookmarkFolderListResponse>(API_ENDPOINTS.bookmark.folders);
  },

  /** 폴더 생성 — sort_order = max+1 */
  createBookmarkFolder: async (payload: CreateBookmarkFolderRequest): Promise<BookmarkFolder> => {
    return await apiClient.post<BookmarkFolder>(API_ENDPOINTS.bookmark.folders, payload);
  },

  /** 폴더 이름 수정 */
  updateBookmarkFolder: async (
    folderId: string,
    payload: UpdateBookmarkFolderRequest
  ): Promise<BookmarkFolder> => {
    return await apiClient.patch<BookmarkFolder>(API_ENDPOINTS.bookmark.folder(folderId), payload);
  },

  /** 폴더 삭제 — 이 폴더에만 있던 북마크만 미분류로 이동 (다른 폴더에도 있으면 그대로 유지) */
  deleteBookmarkFolder: async (folderId: string): Promise<void> => {
    return await apiClient.delete<void>(API_ENDPOINTS.bookmark.folder(folderId));
  },

  /** 폴더 순서 재정렬 — folderIds 전체 (본인 모든 폴더 ID) */
  reorderBookmarkFolders: async (payload: ReorderBookmarkFoldersRequest): Promise<void> => {
    return await apiClient.patch<void>(API_ENDPOINTS.bookmark.reorder, payload);
  },

  /** 폴더별 게시글 조회 — folderKey: 'all' | 'uncategorized' | UUID */
  fetchBookmarkFolderPosts: async (
    folderKey: BookmarkFolderKey,
    payload: PostListRequest & { sort?: BookmarkFolderSort; search?: string }
  ): Promise<PostListResponse> => {
    const { page, size, sort, search } = payload;
    const searchParams: Record<string, string | number> = { page, size };
    if (sort) {
      searchParams.sort = sort;
    }
    if (search) {
      searchParams.search = search;
    }
    return await apiClient.get<PostListResponse>(API_ENDPOINTS.bookmark.folderPosts(folderKey), {
      searchParams,
    });
  },

  /** 폴더에 추가 — 북마크가 없으면 자동 생성 (북마크 보장 + 소속 보장) */
  addBookmarkFolder: async (postId: string, folderId: string): Promise<BookmarkFoldersResponse> => {
    return await apiClient.post<BookmarkFoldersResponse>(
      API_ENDPOINTS.bookmark.postFolder(postId, folderId)
    );
  },

  /** 그 폴더에서만 제거 — 북마크 자체는 유지 (마지막 폴더였어도 미분류로 생존) */
  removeBookmarkFolder: async (
    postId: string,
    folderId: string
  ): Promise<BookmarkFoldersResponse> => {
    return await apiClient.delete<BookmarkFoldersResponse>(
      API_ENDPOINTS.bookmark.postFolder(postId, folderId)
    );
  },

  /** 폴더 소속 전부 해제 — 미분류로. 북마크 자체는 건드리지 않음 */
  clearBookmarkFolders: async (postId: string): Promise<BookmarkFoldersResponse> => {
    return await apiClient.delete<BookmarkFoldersResponse>(
      API_ENDPOINTS.bookmark.postFolders(postId)
    );
  },
};
