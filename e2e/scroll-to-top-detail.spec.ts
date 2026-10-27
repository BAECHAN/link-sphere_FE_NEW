import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';

// 데스크톱 상세의 오른쪽 아래는 맨 위로 버튼 하나다 - 모바일은 하단 댓글 바가 있어 두지
// 않는다(scroll-to-top-detail.mobile.spec.ts, 근거는 docs/COMMENT.md "맨 위로 버튼").
test.describe('글 상세 맨 위로 버튼 — 데스크톱', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) =>
        route.fulfill({
          json: wrapResponse({ ...mockPost, description: `${mockPost.description} `.repeat(80) }),
        })
    );
    await mockComments(
      page,
      Array.from({ length: 15 }, (_, index) => ({
        ...mockComment,
        id: `e2e-comment-${index}`,
        content: `Comment ${index}\n\n${'Long comment line. '.repeat(10)}`,
      }))
    );
  });

  test('내려가면 나타나고 누르면 맨 위로 간다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);
    await page.getByText('Comment 14').waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    const button = page.getByRole('button', { name: 'Scroll to top' });

    await expect(button).toBeVisible();

    await button.click();

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});
