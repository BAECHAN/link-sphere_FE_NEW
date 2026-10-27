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

// 모바일 상세는 하단 댓글 바가 아래쪽을 차지하고, 오른쪽 아래 버튼이 댓글의 수정·삭제를
// 가려 맨 위로 버튼을 두지 않는다(데스크톱은 scroll-to-top-detail.spec.ts).
test.describe('글 상세 맨 위로 버튼 — 모바일', () => {
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

  test('내려가도 나타나지 않는다', async ({ page }) => {
    await page.goto(`/post/${mockPost.id}`);
    await page.getByText('Comment 14').waitFor();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    // 버튼이 나타날 조건(300px 넘게 내림)은 채웠는지 먼저 확인한다
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await expect(page.getByRole('button', { name: 'Scroll to top' })).toBeHidden();
  });
});
