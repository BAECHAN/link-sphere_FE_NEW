import type { Page } from '@playwright/test';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import {
  mockBookmarkFolder,
  mockBookmarkFolderListResponse,
} from '@/mocks/fixtures/bookmark-folder.fixtures';
import type {
  BookmarkFolder,
  BookmarkFoldersResponse,
  UpdateBookmarkFolderRequest,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
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
 * useBookmarkFolders.ts:44-47). mockPost/mockBookmarkFolder의 고정 id로 정확히 매칭한다.
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

/**
 * GET /bookmark/folders + PATCH /bookmark/folders/:folderId — 이름 바꾸기 e2e용.
 * PATCH를 받으면 목록의 이름도 바꿔, 저장 뒤 목록 재조회(handleBookmarkFolderUpdateSuccess)가 새 이름을 받는다.
 * 받은 PATCH 본문을 순서대로 담는 배열을 돌려준다.
 */
export async function mockBookmarkFolderRename(
  page: Page,
  folders: BookmarkFolder[]
): Promise<UpdateBookmarkFolderRequest[]> {
  const current = folders.map((folder) => ({ ...folder }));
  const patchBodies: UpdateBookmarkFolderRequest[] = [];

  await page.route(
    (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
    (route) => route.fulfill({ json: wrapResponse({ folders: current, uncategorizedCount: 0 }) })
  );
  // 폴더 게시글(/folders/:key/posts)·삭제(DELETE)와 경로가 겹치지 않게 끝을 막고 method를 본다
  await page.route(
    (url) => /^\/api\/bookmark\/folders\/[^/]+$/.test(url.pathname),
    (route) => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback();
      }

      const body = route.request().postDataJSON() as UpdateBookmarkFolderRequest;
      const folderId = new URL(route.request().url()).pathname.split('/').pop();
      const folder = current.find((f) => f.id === folderId);
      patchBodies.push(body);

      if (folder) {
        folder.name = body.name;
      }

      return route.fulfill({ json: wrapResponse(folder) });
    }
  );

  return patchBodies;
}
