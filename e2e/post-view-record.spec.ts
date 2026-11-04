import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAccountQuery } from './mocks/account.mock';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPostList, mockRecordPostView } from './mocks/post.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

// 조회는 상세 화면이 뜰 때만 기록한다 - hover 미리 받기는 같은 GET을 보내도 세지 않는다
// (docs/plans/2026-11-05-post-view-record.md). e2e는 StrictMode 개발 서버라 effect가 두 번 돌 수 있어 진입은 "1회 이상"으로 본다.

const POST_TITLE = mockPost.title;
const RECEIVED_VIEW_COUNT = 41;

function countViewRequests(page: Page): { count: () => number } {
  let views = 0;

  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /^\/api\/post\/[^/]+\/view$/.test(new URL(request.url()).pathname)
    ) {
      views += 1;
    }
  });

  return { count: () => views };
}

async function setupRoutes(page: Page, viewStatus = 200): Promise<void> {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockAccountQuery(page);
  await mockCategoryOptions(page);
  await mockPostList(page);
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) =>
      route.fulfill({
        json: wrapResponse({
          ...mockPost,
          stats: { ...mockPost.stats, viewCount: RECEIVED_VIEW_COUNT },
        }),
      })
  );
  await mockComments(page, []);
  await mockRecordPostView(page, viewStatus);
}

test.describe('조회 기록', () => {
  test('카드에 hover만 하면 상세를 미리 받아도 조회를 기록하지 않는다', async ({ page }) => {
    await setupRoutes(page);
    const views = countViewRequests(page);
    const detailRequest = page.waitForRequest((request) =>
      /^\/api\/post\/[^/]+$/.test(new URL(request.url()).pathname)
    );

    await page.goto('/post');
    await page.getByRole('link', { name: POST_TITLE }).first().hover();
    await detailRequest;
    await page.waitForTimeout(300);

    expect(views.count()).toBe(0);
  });

  test('카드를 눌러 상세로 들어가면 조회를 기록한다', async ({ page }) => {
    await setupRoutes(page);
    const views = countViewRequests(page);

    await page.goto('/post');
    await page.getByRole('link', { name: POST_TITLE }).first().click();

    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    await expect.poll(() => views.count()).toBeGreaterThanOrEqual(1);
  });

  test('상세 화면이 뜨면 조회를 기록하고, 받은 값에 1을 더해 보여 준다', async ({ page }) => {
    await setupRoutes(page);
    const views = countViewRequests(page);

    await page.goto(`/post/${mockPost.id}`);

    await expect(page.getByText(String(RECEIVED_VIEW_COUNT + 1), { exact: true })).toBeVisible();
    await expect.poll(() => views.count()).toBeGreaterThanOrEqual(1);
  });

  test('조회 기록이 실패해도 토스트 없이 상세 화면을 유지한다', async ({ page }) => {
    await setupRoutes(page, 500);
    const failedView = page.waitForResponse((response) =>
      /^\/api\/post\/[^/]+\/view$/.test(new URL(response.url()).pathname)
    );

    await page.goto(`/post/${mockPost.id}`);
    await failedView;

    await expect(page.getByRole('heading', { name: POST_TITLE }).first()).toBeVisible();
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
  });

  test('글 수정 화면에 들어가면 상세를 받아도 조회를 기록하지 않는다', async ({ page }) => {
    await setupRoutes(page);
    const views = countViewRequests(page);
    const detailRequest = page.waitForRequest((request) =>
      /^\/api\/post\/[^/]+$/.test(new URL(request.url()).pathname)
    );

    await page.goto(`/post/edit/${mockPost.id}`);
    await detailRequest;
    await page.waitForTimeout(300);

    expect(views.count()).toBe(0);
  });
});
