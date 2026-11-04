import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListWithCommentCount } from './mocks/post.mock';
import { holdComments, mockComments } from './mocks/comment.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { COMMENT_SECTION_HASH } from '@/entities/comment/config/comment.const';
import { TEXTS } from '@/shared/config/texts';

const COMMENT_COUNT = 15;

function makeComments() {
  return Array.from({ length: COMMENT_COUNT }, (_, index) => ({
    ...mockComment,
    id: `e2e-comment-${index}`,
    content: `Comment ${index}\n\n${'Long comment line. '.repeat(10)}`,
  }));
}

async function expectCommentHeadingBelowNavbarAfterIconTap(page: Page): Promise<void> {
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
  await expect(page.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand })).toBeVisible();
}

// 모바일에는 인라인 작성 폼이 없고 하단 고정 바(MobileCommentBar)뿐이라, 카드 댓글 아이콘은
// "댓글 N" 제목까지만 스크롤하고 바는 접힌 채로 둔다(데스크톱은 comment-icon-scroll.spec.ts).
test.describe('카드 댓글 아이콘 — 모바일은 댓글 제목까지 스크롤', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostListWithCommentCount(page, COMMENT_COUNT);
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) =>
        route.fulfill({
          json: wrapResponse({ ...mockPost, description: `${mockPost.description} `.repeat(80) }),
        })
    );
    await mockComments(page, makeComments());
  });

  test('피드에서 누르면 댓글 제목이 navbar 바로 아래로 오고 하단 바는 접혀 있다', async ({
    page,
  }) => {
    await expectCommentHeadingBelowNavbarAfterIconTap(page);
  });

  // 숫자가 0이면 탭의 mouseenter가 빈 목록을 심어 짧은 문서에서 먼저 스크롤한다(CommentList.tsx realignAfterSeedRefetch)
  test('피드·상세 숫자가 모두 옛값(0)이어도 댓글이 도착하면 제목이 navbar 바로 아래로 온다', async ({
    page,
  }) => {
    await mockPostListWithCommentCount(page, 0);

    await expectCommentHeadingBelowNavbarAfterIconTap(page);
  });

  // 상세 응답의 최신 숫자로 댓글이 오는 중임을 알아 뼈대로 자리를 잡는다(useCommentList.ts isAwaitingComments)
  test('피드 숫자만 옛값(0)이면 응답 전에 최신 숫자가 보이고 빈 안내 없이 제목이 navbar 바로 아래로 온다', async ({
    page,
  }) => {
    await mockPostListWithCommentCount(page, 0);
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) =>
        route.fulfill({
          json: wrapResponse({
            ...mockPost,
            description: `${mockPost.description} `.repeat(80),
            stats: { ...mockPost.stats, commentCount: COMMENT_COUNT },
          }),
        })
    );
    const releaseComments = await holdComments(page, makeComments());

    await expectCommentHeadingBelowNavbarAfterIconTap(page);
    await expect(page.locator('h2', { hasText: TEXTS.comment.list.heading })).toContainText(
      String(COMMENT_COUNT)
    );
    await expect(page.getByText(TEXTS.comment.list.empty)).toHaveCount(0);

    releaseComments();

    await expect(page.getByText('Comment 0', { exact: false }).first()).toBeVisible();
  });
});
