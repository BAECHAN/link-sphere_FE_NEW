import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import type { Post, PostListResponse } from '@/entities/post/model/post.schema';

// 열 수를 뷰포트가 아니라 컨테이너 실측 폭으로 정하도록 바꾼 변경(지금은 post-card-grid.const.ts)의
// 회귀 테스트 - PostCard 푸터(좋아요/댓글 pill + 북마크·공유 + 조회수)가 인기글 수준의
// 자릿수에서도 한 줄을 유지하는지, 사이드바 토글로 열 수가 바뀌어도 보던 카드가 화면에
// 남는지 확인한다. minColumnWidth 실측 근거는 docs/plans/2026-09-29-container-width-grid.md.
const POST_COUNT = 30;

function footerPostTitle(index: number): string {
  return `Footer width post ${String(index).padStart(3, '0')}`;
}

/**
 * GET /post - PostCard 푸터가 절대 안 줄바꿈되도록 보장하는 최소 폭(POST_CARD_GRID.minColumnWidth)의
 * 근거였던 "인기글" 시나리오(좋아요·댓글 세 자리, 조회 다섯 자리)로 고정된 통계를 돌려준다.
 */
async function mockWorstCasePosts(page: Page, total: number): Promise<void> {
  const content: Post[] = Array.from({ length: total }, (_, index) => ({
    ...mockPost,
    id: `footer-post-${index}`,
    title: footerPostTitle(index),
    stats: { viewCount: 99999, likeCount: 999, commentCount: 999, bookmarkCount: 0 },
  }));

  const body: PostListResponse = {
    page: 0,
    size: total,
    content,
    totalElements: total,
    totalPages: 1,
    last: true,
  };

  await page.route(
    (url) => isApiPath(url, ENDPOINTS.post.base),
    (route) => route.fulfill({ json: wrapResponse(body) })
  );
}

/**
 * 현재 화면에 렌더된 모든 카드 푸터가 한 줄인지 - 세 그룹(좋아요/댓글, 북마크·공유, 조회수)의
 * "세로 중심"(offsetTop + offsetHeight/2)이 같아야 줄바꿈이 없다. footer는 items-center라
 * 한 줄에서는 그룹 높이가 서로 달라도(예: 좋아요 pill ~36px vs 조회수 ~16px) 세로 중심은
 * 항상 일치한다 - offsetTop만 비교하면 안 되는 이유(같은 줄에서도 높이 차이로 top이
 * 자연히 벌어진다)가 이 테스트를 처음 작성할 때 실측으로 드러났다.
 */
async function expectNoFooterWrap(page: Page): Promise<void> {
  const wrapped = await page.evaluate(() => {
    const footers = Array.from(document.querySelectorAll('[data-slot="card-footer"]'));
    return footers
      .map((footer) => {
        const centers = Array.from(footer.children).map((child) => {
          const el = child as HTMLElement;
          return el.offsetTop + el.offsetHeight / 2;
        });
        return Math.max(...centers) - Math.min(...centers);
      })
      .filter((spread) => spread > 1);
  });

  expect(wrapped).toEqual([]);
}

/** 화면에서 가장 위에 있는 그리드 행의 열 수 - PostList.tsx가 각 행에 인라인으로 넣는
 * gridTemplateColumns를 읽는다. */
async function countTopRowColumns(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grids = Array.from(
      document.querySelectorAll<HTMLElement>('[style*="grid-template-columns"]')
    );
    if (grids.length === 0) {
      return 0;
    }
    const topmost = grids.reduce((a, b) =>
      a.getBoundingClientRect().top <= b.getBoundingClientRect().top ? a : b
    );
    return getComputedStyle(topmost).gridTemplateColumns.split(' ').filter(Boolean).length;
  });
}

test.describe('PostCard 푸터 줄바꿈 방지 - 피드', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockWorstCasePosts(page, POST_COUNT);
  });

  test('1024px(옛 3열 전환 폭)에서도 인기글 통계로 푸터가 줄바꿈되지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto('/post');
    await expect(page.getByRole('link', { name: footerPostTitle(0) })).toBeVisible();

    await expectNoFooterWrap(page);
  });

  test('800px(1열)에서도 푸터가 줄바꿈되지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 });
    await page.goto('/post');
    await expect(page.getByRole('link', { name: footerPostTitle(0) })).toBeVisible();

    await expectNoFooterWrap(page);
  });

  test('1200px에서 ⌘B로 사이드바를 접으면 열 수가 바뀌고, 스크롤해 둔 카드가 화면에 남는다', async ({
    page,
  }) => {
    test.setTimeout(60_000);

    // 1200px는 사이드바가 펼쳐져 있으면(w-60) 2열, 접히면(w-20) 3열이 되는 실측 경계다
    // (Playwright로 직접 측정: 펼침 896px→2열, 접힘 1056px→3열, minColumnWidth=330 기준).
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/post');
    await expect(page.getByRole('link', { name: footerPostTitle(0) })).toBeVisible();

    const columnsBefore = await countTopRowColumns(page);

    // 가상 스크롤이라 화면 밖 카드는 스크롤해야 DOM에 나타난다(post-list-scroll-restore.spec.ts와
    // 같은 이유) - scrollIntoViewIfNeeded는 이미 DOM에 있는 요소에만 쓸 수 있어 먼저 나타날
    // 때까지 반복 스크롤한다.
    const target = page.getByRole('link', { name: footerPostTitle(20) });
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

    await page.keyboard.press('Control+b');

    // ResizeObserver 콜백은 레이아웃이 바뀐 다음 프레임에 비동기로 온다 - 폴링으로 기다린다.
    await expect.poll(() => countTopRowColumns(page)).not.toBe(columnsBefore);

    // 앵커: 토글 전에 보고 있던 카드가 재청크 후에도 화면 안에 남아있어야 한다
    // (useWindowGridVirtualizer.ts의 anchorItemIndexRef → scrollToIndex).
    await expect(target).toBeInViewport();
    await expectNoFooterWrap(page);
  });
});
