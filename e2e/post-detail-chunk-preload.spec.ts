import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

// 터치 기기는 hover가 없어 카드 hover로 미리 받을 틈이 없으므로, 피드를 다 받은 뒤 한가할 때 상세 페이지
// 코드를 미리 받는다(app/routes의 usePreloadPostDetailPageOnTouch, docs/PERFORMANCE.md "상세 첫 진입 빈 화면").
// 마우스 기기는 카드 hover가 게시글·댓글을 미리 받아 청크가 병목이 아니므로 받지 않는다.
const DETAIL_PAGE_MODULE = '/src/pages/post/PostDetailPage.tsx';

function watchDetailModule(page: Page) {
  const state = { requested: false };

  page.on('request', (request) => {
    if (new URL(request.url()).pathname === DETAIL_PAGE_MODULE) {
      state.requested = true;
    }
  });

  return state;
}

async function openFeedAndSettle(page: Page): Promise<void> {
  await page.goto('/post');
  await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
  await page.waitForLoadState('load');
  // 유휴 콜백이 돌 시간을 준다
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
    const detailModule = watchDetailModule(page);

    await openFeedAndSettle(page);

    expect(detailModule.requested).toBe(false);
  });
});

test.describe('터치 기기', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 851 } });

  test('피드를 다 받으면 누르기 전에 상세 페이지 코드를 미리 받는다', async ({ page }) => {
    const detailModule = watchDetailModule(page);

    await page.goto('/post');

    await expect.poll(() => detailModule.requested, { timeout: 15000 }).toBe(true);
    await expect(page).toHaveURL(/\/post$/);
  });

  test('데이터 절약 모드면 미리 받지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { value: { saveData: true } });
    });
    const detailModule = watchDetailModule(page);

    await openFeedAndSettle(page);

    expect(detailModule.requested).toBe(false);
  });
});
