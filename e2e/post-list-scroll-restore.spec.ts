import { test, expect, type Page, type Locator } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged, mockPostDetail, pagedPostTitle } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// 3열(데스크톱) × 20행. 40번째 카드(13번째 행)를 대상으로 삼는다 — usePostList.ts의
// 프리페치 조건(lastVirtualRowIndex >= rows.length - 5)이 그 지점에서 처음 false가 되어,
// 카드를 클릭하는 시점엔 60개 전부가 결정적으로 로드된 상태로 수렴한다.
const TOTAL_POSTS = 60;
const TARGET_POST_INDEX = 40;
const POSITION_TOLERANCE_PX = 50;

async function scrollToTargetCard(page: Page): Promise<Locator> {
  const target = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });

  // expect.poll로 목표 카드가 나타날 때까지 반복 스크롤한다 — 몇 번 스크롤해야 그
  // 카드까지 로드되는지 미리 계산하지 않고, 실제로 나타났는지로 조건을 수렴시킨다.
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

async function expectSamePosition(target: Locator, before: { y: number }) {
  // boundingBox()는 뷰포트 기준 좌표라 "화면 안 같은 자리"를 직접 검증한다.
  await expect
    .poll(async () => {
      const box = await target.boundingBox();
      return box ? Math.abs(box.y - before.y) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
}

test.describe('피드 가상 스크롤 — 뒤로가기 시 스크롤 위치 복원', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostListPaged(page, { total: TOTAL_POSTS });
    await mockPostDetail(page);
    await mockComments(page, []);
  });

  test('"목록으로" 버튼으로 돌아와도 같은 카드가 같은 자리에 있다', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/post');

    const target = await scrollToTargetCard(page);
    const beforeBox = await target.boundingBox();

    if (!beforeBox) {
      throw new Error('대상 카드의 위치를 읽지 못했다');
    }

    await target.click();
    const backToListButton = page.getByRole('button', { name: TEXTS.post.detail.backToList });
    await expect(backToListButton).toBeVisible();

    await backToListButton.click();
    await expect(page).toHaveURL(/\/post$/);

    const restoredTarget = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });
    await expectSamePosition(restoredTarget, { y: beforeBox.y });
  });

  test('브라우저 뒤로가기로도 같은 카드가 같은 자리에 있다', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/post');

    const target = await scrollToTargetCard(page);
    const beforeBox = await target.boundingBox();

    if (!beforeBox) {
      throw new Error('대상 카드의 위치를 읽지 못했다');
    }

    await target.click();
    // mockPostDetail은 클릭한 id와 무관하게 항상 mockPost(고정 제목)를 돌려준다 — 그 제목으로
    // 특정해서 기다려야 한다. 이름 없이 getByRole('heading', { level: 3 })만 쓰면 전환 중
    // 목록 페이지의 카드 제목들과 겹쳐 strict mode violation이 나는데, Playwright는 이
    // 위반을 "아직 못 찾음"으로 재시도하지 않고 즉시 실패시킨다(실측 확인) — 그래서 타임아웃을
    // 늘려도 소용없고, 애초에 유일하게 매칭되는 선택자를 써야 한다.
    await expect(page.getByRole('heading', { name: mockPost.title, level: 3 })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);

    const restoredTarget = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });
    await expectSamePosition(restoredTarget, { y: beforeBox.y });
  });
});
