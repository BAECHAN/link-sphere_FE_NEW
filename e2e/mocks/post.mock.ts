import type { Page } from '@playwright/test';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

/**
 * GET /post (목록) — src/mocks/handlers/post.handlers.ts와 같은 고정값을 재사용한다.
 * pathname만 보므로(URL.pathname은 쿼리스트링을 포함하지 않는다) `?q=...` 같은
 * 검색어가 붙어도 그대로 매칭된다.
 */
export async function mockPostList(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => route.fulfill({ json: wrapResponse(mockPostListResponse) })
  );
}

/** GET /post/:id (상세) — 댓글 목록 엔드포인트(/post/:id/comment)와 겹치지 않게 세그먼트 하나만 허용한다. */
export async function mockPostDetail(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(mockPost) })
  );
}
