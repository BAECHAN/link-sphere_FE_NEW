import { test, expect, type Page, type Locator } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged, mockPostDetail, pagedPostTitle } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

// 모바일(Pixel 5, 393px)은 1열이라 데스크톱 파일(3열)이 전혀 검증 못 하는 columnCount=1
// 경로다. 총 40개(=40행), 15번째 카드로 스크롤한다. 돌아가기 버튼이 모바일엔 없으므로
// (post-detail-back.mobile.spec.ts 참고) page.goBack() 1케이스만 있다.
const TOTAL_POSTS = 40;
const TARGET_POST_INDEX = 15;
const POSITION_TOLERANCE_PX = 50;

async function scrollToTargetCard(page: Page): Promise<Locator> {
  const target = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });

  // page.touchscreen 스와이프는 쓰지 않는다 — Pixel 5는 hasTouch: true라 터치 제스처가
  // usePullToRefresh를 깨워 scrollMargin 측정을 오염시킨다(PostList.tsx 참고).
  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        return target.count();
      },
      { timeout: 30_000, intervals: [300] }
    )
    .toBeGreaterThan(0);

  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();

  return target;
}

test.describe('피드 가상 스크롤(모바일 1열) — 뒤로가기 시 스크롤 위치 복원', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostListPaged(page, { total: TOTAL_POSTS });
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('브라우저 뒤로가기로 같은 카드가 같은 자리에 있다', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/post');

    const target = await scrollToTargetCard(page);
    const beforeBox = await target.boundingBox();

    if (!beforeBox) {
      throw new Error('대상 카드의 위치를 읽지 못했다');
    }

    await target.click();
    // mockPostDetail은 클릭한 id와 무관하게 항상 mockPost(고정 제목)를 돌려준다.
    await expect(page.getByRole('heading', { name: mockPost.title, level: 3 })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);

    const restoredTarget = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });

    await expect
      .poll(async () => {
        const box = await restoredTarget.boundingBox();
        return box ? Math.abs(box.y - beforeBox.y) : Number.POSITIVE_INFINITY;
      })
      .toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  });
});
