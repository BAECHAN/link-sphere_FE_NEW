import { http, HttpResponse } from 'msw';
import { mockFolderListResponse } from '@/mocks/fixtures/folder.fixtures';
import { API_ENDPOINTS } from '@/shared/config/api';
import type { BookmarkFoldersResponse } from '@/entities/folder/model/folder.schema';

export const folderHandlers = [
  // GET /bookmark/folders (폴더 목록)
  http.get(`${API_ENDPOINTS.bookmark.folders}`, () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: mockFolderListResponse,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /bookmark/:postId/folders/:folderId (폴더에 추가)
  http.post(`${API_ENDPOINTS.bookmark.postFolder(':postId', ':folderId')}`, ({ params }) => {
    const data: BookmarkFoldersResponse = {
      postId: String(params['postId']),
      isBookmarked: true,
      folderIds: [String(params['folderId'])],
    };
    return HttpResponse.json(
      { status: 200, message: 'ok', data, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }),

  // DELETE /bookmark/:postId/folders/:folderId (그 폴더에서만 제거)
  http.delete(`${API_ENDPOINTS.bookmark.postFolder(':postId', ':folderId')}`, ({ params }) => {
    const data: BookmarkFoldersResponse = {
      postId: String(params['postId']),
      isBookmarked: true,
      folderIds: [],
    };
    return HttpResponse.json(
      { status: 200, message: 'ok', data, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }),

  // DELETE /bookmark/:postId/folders (소속 전체 해제)
  http.delete(`${API_ENDPOINTS.bookmark.postFolders(':postId')}`, ({ params }) => {
    const data: BookmarkFoldersResponse = {
      postId: String(params['postId']),
      isBookmarked: true,
      folderIds: [],
    };
    return HttpResponse.json(
      { status: 200, message: 'ok', data, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }),
];
