import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockBookmarkFolderListResponse } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { Post, PostListResponse } from '@/entities/post/model/post.schema';

// 북마크 페이지는 폴더트리(w-60 + gap-6)까지 폭을 가져가 피드보다 카드가 더 좁아진다
// (post-card-footer-layout.spec.ts와 같은 이유의 회귀 테스트, 근거는
// docs/plans/2026-09-29-container-width-grid.md).
const POST_COUNT = 12;

function footerPostTitle(index: number): string {
  return `Bookmark footer width post ${String(index).padStart(3, '0')}`;
}

/** GET /bookmark/folders/:folderKey/posts - post-card-footer-layout.spec.ts의
 * mockWorstCasePosts와 같은 "인기글" 통계 고정값. */
async function mockWorstCaseBookmarkPosts(page: Page, total: number): Promise<void> {
  const content: Post[] = Array.from({ length: total }, (_, index) => ({
    ...mockPost,
    id: `bookmark-footer-post-${index}`,
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
    (url) => /^\/api\/bookmark\/folders\/[^/]+\/posts$/.test(url.pathname),
    (route) => route.fulfill({ json: wrapResponse(body) })
  );
}

/** post-card-footer-layout.spec.ts와 동일 - 렌더된 모든 카드 푸터가 한 줄인지, 세 그룹의
 * 세로 중심(offsetTop + offsetHeight/2)이 같은지로 확인한다. */
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

test.describe('PostCard 푸터 줄바꿈 방지 - 북마크', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockWorstCaseBookmarkPosts(page, POST_COUNT);

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) => route.fulfill({ json: wrapResponse(mockBookmarkFolderListResponse) })
    );
  });

  test('1280px에서도 인기글 통계로 푸터가 줄바꿈되지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/bookmark');
    await expect(page.getByRole('link', { name: footerPostTitle(0) })).toBeVisible();

    await expectNoFooterWrap(page);
  });

  test('1100px(폴더트리까지 폭을 가져가는 구간)에서도 푸터가 줄바꿈되지 않는다', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto('/bookmark');
    await expect(page.getByRole('link', { name: footerPostTitle(0) })).toBeVisible();

    await expectNoFooterWrap(page);
  });
});
