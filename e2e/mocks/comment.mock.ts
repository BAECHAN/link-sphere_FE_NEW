import type { Page } from '@playwright/test';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { wrapResponse } from './wrap-response';

/** GET /post/:id/comment (댓글 목록) — 상세 페이지의 CommentList가 마운트마다 호출한다. */
export async function mockComments(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse([mockComment]) })
  );
}
