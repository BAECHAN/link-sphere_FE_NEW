import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 좋아요가 10,000개를 넘는 회원의 "좋아요한" 필터는 최근 10,000개 안에서만 거른다(BE #222). 서버가 응답에
// likedFilterLimit을 실었을 때만 목록 위에 그 사실을 적는다(docs/SEARCH.md §5 범위 칩).
const NOTICE = TEXTS.post.search.likedFilterLimited(10000);
const LIKED_CHIP = TEXTS.buttons.likedOnly;

/** GET /post — filter에 isLiked가 있을 때만 likedFilterLimit을 싣는다(BE와 같은 조건). */
async function mockPostListWithLikedLimit(page: Page, content = mockPostListResponse.content) {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => {
      const filter = new URL(route.request().url()).searchParams.get('filter') ?? '';

      return route.fulfill({
        json: wrapResponse({
          ...mockPostListResponse,
          content,
          likedFilterLimit: filter.includes('isLiked') ? 10000 : null,
        }),
      });
    }
  );
}

test.describe('좋아요 필터 범위 안내', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
  });

  test('좋아요한 칩을 켜면 필터 카드와 첫 글 사이에 안내가 뜨고, 끄면 사라진다', async ({
    page,
  }, testInfo) => {
    await mockPostListWithLikedLimit(page);
    await page.goto('/post');

    const chip = page.getByRole('button', { name: LIKED_CHIP });
    const notice = page.getByText(NOTICE);
    const firstCard = page.getByRole('link', { name: mockPost.title });

    await expect(firstCard).toBeVisible();
    await expect(notice).toBeHidden();

    await chip.click();
    await expect(notice).toBeVisible();

    const chipBox = (await chip.boundingBox())!;
    const noticeBox = (await notice.boundingBox())!;
    const cardBox = (await firstCard.boundingBox())!;

    expect(noticeBox.y).toBeGreaterThan(chipBox.y + chipBox.height);
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(cardBox.y);
    await page.screenshot({ path: testInfo.outputPath('liked-filter-notice-desktop.png') });

    // 같은 칩의 빠른 재클릭은 중복 클릭으로 보고 무시된다(useClickGuard 400ms)
    await page.waitForTimeout(450);
    await chip.click();
    await expect(notice).toBeHidden();
  });

  test('좁은 화면에서도 안내가 한 줄로 첫 글 위에 뜬다', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await mockPostListWithLikedLimit(page);
    await page.goto('/post?filter=isLiked');

    const notice = page.getByText(NOTICE);
    await expect(notice).toBeVisible();

    const noticeBox = (await notice.boundingBox())!;
    const cardBox = (await page.getByRole('link', { name: mockPost.title }).boundingBox())!;

    // text-sm 한 줄 높이(20px) - 두 줄로 접히면 40px이 된다
    expect(noticeBox.height).toBeLessThan(30);
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(cardBox.y);
    await page.screenshot({ path: testInfo.outputPath('liked-filter-notice-mobile.png') });
  });

  test('결과가 없을 때도 빈 목록 안내 위에 뜬다', async ({ page }, testInfo) => {
    await mockPostListWithLikedLimit(page, []);
    await page.goto('/post?filter=isLiked');

    const notice = page.getByText(NOTICE);
    const empty = page.getByText(TEXTS.messages.info.noPosts);

    await expect(notice).toBeVisible();
    await expect(empty).toBeVisible();

    const noticeBox = (await notice.boundingBox())!;
    const emptyBox = (await empty.boundingBox())!;

    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(emptyBox.y);
    await page.screenshot({ path: testInfo.outputPath('liked-filter-notice-empty.png') });
  });
});
