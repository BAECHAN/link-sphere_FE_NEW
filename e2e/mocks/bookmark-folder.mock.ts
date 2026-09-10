import type { Page } from '@playwright/test';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import {
  mockBookmarkFolder,
  mockBookmarkFolderListResponse,
} from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { BookmarkFoldersResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

/**
 * GET /bookmark/folders — 폴더 선택 모달이 열릴 때만 조회한다
 * (open=true일 때만 enabled, useBookmarkFolderSelect.ts:33).
 */
export async function mockBookmarkFolderList(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
    (route) => route.fulfill({ json: wrapResponse(mockBookmarkFolderListResponse) })
  );
}

/**
 * GET /bookmark/folders/:folderKey/posts — `/bookmark` 페이지(BookmarkPage.tsx)가
 * 데스크톱 기본값 'all' 등 어떤 folderKey로든 항상 조회한다(BookmarkPostList). pathname에
 * folderKey가 끼어 있어 isApiPath의 정확 일치로는 못 잡으므로 정규식으로 매칭한다.
 */
export async function mockBookmarkFolderPosts(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(mockPostListResponse) })
  );
}

/**
 * POST /bookmark/:postId/folders/:folderId — 폴더 행 탭(비소속 상태에서 추가,
 * useBookmarkFolders.ts:36-40). mockPost/mockBookmarkFolder의 고정 id로 정확히 매칭한다.
 */
export async function mockAddBookmarkFolder(page: Page): Promise<void> {
  const data: BookmarkFoldersResponse = {
    postId: mockPost.id,
    isBookmarked: true,
    folderIds: [mockBookmarkFolder.id],
  };

  await page.route(
    (url) => isApiPath(url, ENDPOINTS.bookmark.postFolder(mockPost.id, mockBookmarkFolder.id)),
    (route) => route.fulfill({ json: wrapResponse(data) })
  );
}
