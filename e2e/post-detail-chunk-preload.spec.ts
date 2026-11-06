import type { Page, Route } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';

// 터치 기기는 hover가 없어 카드 hover로 미리 받을 틈이 없으므로, 피드 첫 썸네일이 그려진 뒤 한가할 때 상세 페이지
// 코드를 미리 받는다(app/routes의 usePreloadPostDetailPageOnTouch, docs/PERFORMANCE.md "상세 첫 진입 빈 화면").
// 마우스 기기는 카드 hover가 게시글·댓글을 미리 받아 청크가 병목이 아니므로 받지 않는다.
const DETAIL_PAGE_MODULE = '/src/pages/post/PostDetailPage.tsx';
const THUMBNAIL_URL = 'https://thumbnail.e2e.test/og.png';
// LCP 후보가 되려면 썸네일 칸보다 작지 않고 정보량이 있는 이미지여야 한다 — 1×1이나 단색 이미지는 LCP로 잡히지 않는다
const THUMBNAIL_FILE = 'public/favicons/android-chrome-512x512.png';

function watchDetailModule(page: Page) {
  const state = { requested: false };

  page.on('request', (request) => {
    if (new URL(request.url()).pathname === DETAIL_PAGE_MODULE) {
      state.requested = true;
    }
  });

  return state;
}

/** 첫 카드에 썸네일을 단다. mockPostList와 조건이 같아 나중에 등록한 이쪽이 이긴다(LIFO) */
async function mockPostListWithThumbnail(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) =>
      route.fulfill({
        json: wrapResponse({
          ...mockPostListResponse,
          content: [{ ...mockPost, ogImage: THUMBNAIL_URL }],
        }),
      })
  );
}

async function serveThumbnail(page: Page): Promise<void> {
  await page.route(THUMBNAIL_URL, (route) => route.fulfill({ path: THUMBNAIL_FILE }));
}

/** 썸네일 응답을 붙잡아 두고, 돌려준 함수를 부르면 그때 보낸다 */
async function holdThumbnail(page: Page): Promise<() => Promise<void>> {
  let heldRoute: Route | undefined;

  await page.route(THUMBNAIL_URL, (route) => {
    heldRoute = route;
  });

  return async () => {
    await expect.poll(() => heldRoute !== undefined).toBe(true);
    await heldRoute?.fulfill({ path: THUMBNAIL_FILE });
  };
}

/** 썸네일이 있으면 원본 링크 이름에도 제목이 들어가 exact로 제목 링크만 찾는다 */
function feedTitleLink(page: Page) {
  return page.getByRole('link', { name: mockPost.title, exact: true });
}

async function openFeedAndSettle(page: Page): Promise<void> {
  await page.goto('/post');
  await expect(feedTitleLink(page)).toBeVisible();
  await page.waitForLoadState('load');
  // 썸네일 LCP 뒤 유휴 콜백이 돌 시간을 준다
  await page.waitForTimeout(1000);
}

test.beforeEach(async ({ page }) => {
  await installCatchAll(page);
  await mockCategoryOptions(page);
  await mockPostList(page);
  await mockPostDetail(page);
  await mockComments(page);
});

test.describe('마우스 기기', () => {
  test('피드를 열어 두기만 해서는 상세 페이지 코드를 받지 않는다', async ({ page }) => {
    await mockPostListWithThumbnail(page);
    await serveThumbnail(page);
    const detailModule = watchDetailModule(page);

    await openFeedAndSettle(page);

    expect(detailModule.requested).toBe(false);
  });
});

test.describe('터치 기기', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 } });

  test('첫 썸네일이 그려지기 전에는 받지 않고, 그려지면 미리 받는다', async ({ page }) => {
    await mockPostListWithThumbnail(page);
    const releaseThumbnail = await holdThumbnail(page);
    const detailModule = watchDetailModule(page);

    // 붙잡아 둔 썸네일은 load 이벤트를 늦출 수 있어 문서 응답까지만 기다린다
    await page.goto('/post', { waitUntil: 'commit' });
    await expect(feedTitleLink(page)).toBeVisible();
    await page.waitForTimeout(1500);

    expect(detailModule.requested).toBe(false);

    await releaseThumbnail();

    // 썸네일 없이 기다리는 대체 시간(load 5초 뒤)보다 먼저 와야 썸네일을 보고 받은 것이다
    await expect.poll(() => detailModule.requested, { timeout: 2500 }).toBe(true);
    await expect(page).toHaveURL(/\/post$/);
  });

  test('첫 카드에 썸네일이 없어도 잠시 뒤 미리 받는다', async ({ page }) => {
    const detailModule = watchDetailModule(page);

    await page.goto('/post');

    await expect.poll(() => detailModule.requested, { timeout: 15000 }).toBe(true);
    await expect(page).toHaveURL(/\/post$/);
  });

  test('데이터 절약 모드면 미리 받지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true } });
    });
    await mockPostListWithThumbnail(page);
    await serveThumbnail(page);
    const detailModule = watchDetailModule(page);

    await openFeedAndSettle(page);

    expect(detailModule.requested).toBe(false);
  });
});
