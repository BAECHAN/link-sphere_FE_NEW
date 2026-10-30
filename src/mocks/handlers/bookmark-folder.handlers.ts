import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';
import type {
  BookmarkFolderPinResponse,
  BookmarkFoldersResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

export const bookmarkFolderHandlers = [
  // GET /bookmark/folders (폴더 목록)
  http.get('/bookmark/folders', () => {
    return MockEnvelopeUtil.json(mockBookmarkFolderListResponse);
  }),

  // PUT /bookmark/folders/{folderId}/pin (고정) — 픽스처 폴더는 고정하지 않은 상태로 둔다(e2e 셀렉터가 폴더 이름
  // 버튼을 찾는다). 고정 상태가 필요한 테스트는 목록 응답을 따로 덮어쓴다
  http.put('/bookmark/folders/{folderId}/pin', ({ params }) => {
    const data: BookmarkFolderPinResponse = {
      id: params.folderId,
      pinnedAt: '2026-10-26T12:00:00',
    };
    return MockEnvelopeUtil.json(data);
  }),

  // DELETE /bookmark/folders/{folderId}/pin (고정 해제)
  http.delete('/bookmark/folders/{folderId}/pin', ({ params }) => {
    const data: BookmarkFolderPinResponse = { id: params.folderId, pinnedAt: null };
    return MockEnvelopeUtil.json(data);
  }),

  // POST /bookmark/{postId}/folders/{folderId} (폴더에 추가)
  http.post('/bookmark/{postId}/folders/{folderId}', ({ params }) => {
    const data: BookmarkFoldersResponse = {
      postId: params.postId,
      isBookmarked: true,
      folderIds: [params.folderId],
    };
    return MockEnvelopeUtil.json(data);
  }),

  // DELETE /bookmark/{postId}/folders/{folderId} (그 폴더에서만 제거). removeBookmarkIfEmpty=true면
  // 남은 소속이 없으니(folderIds: []) 북마크도 지워진 응답이다
  http.delete('/bookmark/{postId}/folders/{folderId}', ({ params, query }) => {
    const removeBookmarkIfEmpty = query.get('removeBookmarkIfEmpty') === 'true';
    const data: BookmarkFoldersResponse = {
      postId: params.postId,
      isBookmarked: !removeBookmarkIfEmpty,
      folderIds: [],
    };
    return MockEnvelopeUtil.json(data);
  }),

  // DELETE /bookmark/{postId}/folders (소속 전체 해제)
  http.delete('/bookmark/{postId}/folders', ({ params }) => {
    const data: BookmarkFoldersResponse = {
      postId: params.postId,
      isBookmarked: true,
      folderIds: [],
    };
    return MockEnvelopeUtil.json(data);
  }),
];
