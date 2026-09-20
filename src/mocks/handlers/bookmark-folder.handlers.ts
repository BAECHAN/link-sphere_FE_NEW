import { http, HttpResponse } from 'msw';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import type { BookmarkFoldersResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';

/** 핸들러 URL에 API_BASE_URL prefix를 붙여 실제 요청 URL과 일치시킵니다. */
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

export const bookmarkFolderHandlers = [
  // GET /bookmark/folders (폴더 목록)
  http.get(url(API_ENDPOINTS.bookmark.folders), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: mockBookmarkFolderListResponse,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /bookmark/:postId/folders/:folderId (폴더에 추가)
  http.post(url(API_ENDPOINTS.bookmark.postFolder(':postId', ':folderId')), ({ params }) => {
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
  http.delete(url(API_ENDPOINTS.bookmark.postFolder(':postId', ':folderId')), ({ params }) => {
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
  http.delete(url(API_ENDPOINTS.bookmark.postFolders(':postId')), ({ params }) => {
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
