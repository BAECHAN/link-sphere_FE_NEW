import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { PostListRequest, PostListResponse } from '@/entities/post/model/post.schema';
import {
  BookmarkFoldersResponse,
  CreateFolderRequest,
  Folder,
  FolderKey,
  FolderListResponse,
  FolderSort,
  ReorderFoldersRequest,
  UpdateFolderRequest,
} from '@/entities/folder/model/folder.schema';

export const folderApi = {
  /** 내 폴더 목록 (bookmarkCount 포함, sortOrder ASC) + 미분류 개수 */
  fetchFolderList: async (): Promise<FolderListResponse> => {
    return await apiClient.get<FolderListResponse>(API_ENDPOINTS.bookmark.folders);
  },

  /** 폴더 생성 — sort_order = max+1 */
  createFolder: async (payload: CreateFolderRequest): Promise<Folder> => {
    return await apiClient.post<Folder>(API_ENDPOINTS.bookmark.folders, payload);
  },

  /** 폴더 이름 수정 */
  updateFolder: async (folderId: string, payload: UpdateFolderRequest): Promise<Folder> => {
    return await apiClient.patch<Folder>(API_ENDPOINTS.bookmark.folder(folderId), payload);
  },

  /** 폴더 삭제 — 이 폴더에만 있던 북마크만 미분류로 이동 (다른 폴더에도 있으면 그대로 유지) */
  deleteFolder: async (folderId: string): Promise<void> => {
    return await apiClient.delete<void>(API_ENDPOINTS.bookmark.folder(folderId));
  },

  /** 폴더 순서 재정렬 — folderIds 전체 (본인 모든 폴더 ID) */
  reorderFolders: async (payload: ReorderFoldersRequest): Promise<void> => {
    return await apiClient.patch<void>(API_ENDPOINTS.bookmark.reorder, payload);
  },

  /** 폴더별 게시글 조회 — folderKey: 'all' | 'uncategorized' | UUID */
  fetchFolderPosts: async (
    folderKey: FolderKey,
    payload: PostListRequest & { sort?: FolderSort; search?: string }
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
