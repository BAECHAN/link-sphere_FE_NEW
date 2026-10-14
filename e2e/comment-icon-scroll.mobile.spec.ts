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
import { COMMENT_SECTION_HASH } from '@/entities/comment/config/comment.const';
import { TEXTS } from '@/shared/config/texts';

// 모바일에는 인라인 작성 폼이 없고 하단 고정 바(MobileCommentBar)뿐이라, 카드 댓글 아이콘은
// "댓글 N" 제목까지만 스크롤하고 바는 접힌 채로 둔다(데스크톱은 comment-icon-scroll.spec.ts).
test.describe('카드 댓글 아이콘 — 모바일은 댓글 제목까지 스크롤', () => {
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

  test('피드에서 누르면 댓글 제목이 navbar 바로 아래로 오고 하단 바는 접혀 있다', async ({
    page,
  }) => {
    await page.goto('/post');
    await page.locator(`a[href="/post/${mockPost.id}${COMMENT_SECTION_HASH}"]`).click();

    await expect(page).toHaveURL(new RegExp(`${COMMENT_SECTION_HASH}$`));
    await expect
      .poll(() =>
        page.evaluate((heading) => {
          const navbarHeight = parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')
          );
          const anchor = Array.from(document.querySelectorAll('h2')).find((el) =>
            el.textContent?.startsWith(heading)
          );

          // 상세(lazy)·댓글(Suspense)이 아직 안 그려졌으면 다음 poll에서 다시 잰다
          if (!anchor) {
            return Number.POSITIVE_INFINITY;
          }

          const top = anchor.getBoundingClientRect().top;

          return Math.abs(top - navbarHeight);
        }, TEXTS.comment.list.heading)
      )
      .toBeLessThanOrEqual(2);
    await expect(
      page.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand })
    ).toBeVisible();
  });
});
