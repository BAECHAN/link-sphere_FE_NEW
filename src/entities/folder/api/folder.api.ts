import { apiClient } from '@/shared/api/client';
import { API_ENDPOINTS } from '@/shared/config/api';
import { PostListRequest, PostListResponse } from '@/entities/post/model/post.schema';
import {
  CreateFolderRequest,
  Folder,
  FolderKey,
  FolderList,
  FolderSort,
  MoveBookmarkRequest,
  ReorderFoldersRequest,
  UpdateFolderRequest,
} from '@/entities/folder/model/folder.schema';

export const folderApi = {
  /** 내 폴더 목록 (bookmarkCount 포함, sortOrder ASC) */
  fetchFolderList: async (): Promise<FolderList> => {
    return await apiClient.get<FolderList>(API_ENDPOINTS.bookmark.folders);
  },

  /** 폴더 생성 — sort_order = max+1 */
  createFolder: async (payload: CreateFolderRequest): Promise<Folder> => {
    return await apiClient.post<Folder>(API_ENDPOINTS.bookmark.folders, payload);
  },

  /** 폴더 이름 수정 */
  updateFolder: async (folderId: string, payload: UpdateFolderRequest): Promise<Folder> => {
    return await apiClient.patch<Folder>(API_ENDPOINTS.bookmark.folder(folderId), payload);
  },

  /** 폴더 삭제 — 안의 북마크는 미분류로 자동 이동 (BE ON DELETE SET NULL) */
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
    payload: PostListRequest & { sort?: FolderSort }
  ): Promise<PostListResponse> => {
    const { page, size, sort } = payload;
    const searchParams: Record<string, string | number> = { page, size };
    if (sort) searchParams.sort = sort;
    return await apiClient.get<PostListResponse>(API_ENDPOINTS.bookmark.folderPosts(folderKey), {
      searchParams,
    });
  },

  /** 단건 북마크 폴더 이동 — folderId=null 이면 미분류로 */
  moveBookmark: async (postId: string, payload: MoveBookmarkRequest): Promise<void> => {
    return await apiClient.patch<void>(API_ENDPOINTS.bookmark.moveBookmark(postId), payload);
  },
};
