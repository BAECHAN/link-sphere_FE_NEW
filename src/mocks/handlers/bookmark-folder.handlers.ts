import { http, HttpResponse } from 'msw';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import type {
  BookmarkFolderPinResponse,
  BookmarkFoldersResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

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

  // PUT /bookmark/folders/:folderId/pin (고정) — 픽스처 폴더는 고정하지 않은 상태로 둔다(e2e 셀렉터가 폴더 이름
  // 버튼을 찾는다). 고정 상태가 필요한 테스트는 목록 응답을 따로 덮어쓴다
  http.put(url(API_ENDPOINTS.bookmark.folderPin(':folderId')), ({ params }) => {
    const data: BookmarkFolderPinResponse = {
      id: String(params['folderId']),
      pinnedAt: '2026-10-26T12:00:00',
    };
    return HttpResponse.json(
      { status: 200, message: 'ok', data, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }),

  // DELETE /bookmark/folders/:folderId/pin (고정 해제)
  http.delete(url(API_ENDPOINTS.bookmark.folderPin(':folderId')), ({ params }) => {
    const data: BookmarkFolderPinResponse = { id: String(params['folderId']), pinnedAt: null };
    return HttpResponse.json(
      { status: 200, message: 'ok', data, timestamp: new Date().toISOString() },
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

  // DELETE /bookmark/:postId/folders/:folderId (그 폴더에서만 제거). removeBookmarkIfEmpty=true면
  // 남은 소속이 없으니(folderIds: []) 북마크도 지워진 응답이다
  http.delete(
    url(API_ENDPOINTS.bookmark.postFolder(':postId', ':folderId')),
    ({ params, request }) => {
      const removeBookmarkIfEmpty =
        new URL(request.url).searchParams.get('removeBookmarkIfEmpty') === 'true';
      const data: BookmarkFoldersResponse = {
        postId: String(params['postId']),
        isBookmarked: !removeBookmarkIfEmpty,
        folderIds: [],
      };
      return HttpResponse.json(
        { status: 200, message: 'ok', data, timestamp: new Date().toISOString() },
        { status: 200 }
      );
    }
  ),

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
