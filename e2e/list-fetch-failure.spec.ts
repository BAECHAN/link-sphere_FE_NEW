import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { POST_PAGE_SIZE } from '@/entities/post/config/post.const';
import { TEXTS } from '@/shared/config/texts';

// 목록 조회가 실패했을 때 화면에 실패 흔적이 남는지(#491 1·2번).

test.describe('목록 조회 실패', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockBookmarkFolderList(page);
  });

  test('피드 다음 페이지가 429로 실패하면 같은 요청을 다시 보내지 않고, 다시 시도로 받는다', async ({
    page,
  }) => {
    const nextPageRequests: number[] = [];
    let nextPageFails = true;

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) => {
        const pageParam = Number(new URL(route.request().url()).searchParams.get('page') ?? 0);

        if (pageParam > 0) {
          nextPageRequests.push(pageParam);
        }

        if (pageParam > 0 && nextPageFails) {
          return route.fulfill({
            status: 429,
            json: { status: 429, message: 'too many requests', data: null, timestamp: '' },
          });
        }

        return route.fulfill({
          json: wrapResponse({
            page: pageParam,
            size: POST_PAGE_SIZE,
            content: Array.from({ length: POST_PAGE_SIZE }, (_, offset) => {
              const index = pageParam * POST_PAGE_SIZE + offset;
              return { ...mockPost, id: `e2e-post-${index}`, title: `E2E Post ${index}` };
            }),
            totalElements: POST_PAGE_SIZE * 2,
            totalPages: 2,
            last: pageParam >= 1,
          }),
        });
      }
    );

    await page.goto('/post');
    await expect(page.getByRole('link', { name: 'E2E Post 0', exact: true })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => nextPageRequests.length).toBeGreaterThanOrEqual(1);
    // 실패 뒤에도 끝에 머물러 있는 동안 다시 보내는지 본다
    await page.waitForTimeout(3000);

    expect(nextPageRequests).toHaveLength(1);
    await expect(page.getByText(TEXTS.messages.error.loadMoreFailed)).toBeVisible();

    nextPageFails = false;
    await page.getByRole('button', { name: TEXTS.buttons.retry }).click();

    await expect(
      page.getByRole('link', { name: `E2E Post ${POST_PAGE_SIZE}`, exact: true })
    ).toBeAttached();
    expect(nextPageRequests).toHaveLength(2);
    await expect(page.getByText(TEXTS.messages.error.loadMoreFailed)).toHaveCount(0);
  });

  test('북마크 폴더 글 조회가 실패하면 빈 목록 대신 오류 문구를 보여준다', async ({ page }) => {
    await page.route(
      (url) => /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(url.pathname),
      (route) =>
        route.fulfill({
          status: 500,
          json: { status: 500, message: 'server error', data: null, timestamp: '' },
        })
    );

    await page.goto('/bookmark');

    await expect(page.getByText(TEXTS.messages.error.fetchPosts)).toBeVisible();
    await expect(page.getByText(TEXTS.bookmark.empty.all)).toHaveCount(0);
  });
});
