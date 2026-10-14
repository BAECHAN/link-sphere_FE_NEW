import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { COMMENT_SECTION_HASH } from '@/entities/comment/config/comment.const';
import { TEXTS } from '@/shared/config/texts';

// 카드의 댓글 아이콘은 /post/:id#comments로 이동하고, 상세의 CommentList가 그 해시를 보고 작성
// 폼으로 스크롤한 뒤 포커스한다(CommentList.tsx scrollToHashedComment). 스크롤이 실제로 일어났는지
// 보려면 상세가 화면보다 충분히 길어야 해서 - 폼 위(긴 설명)와 아래(댓글 여러 개) 모두 늘린다.
const COMMENT_COUNT = 15;
const HASHED_COMMENT_INDEX = 10;

function commentId(index: number): string {
  return `e2e-comment-${index}`;
}

async function mockTallPostDetail(page: Page): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) =>
      route.fulfill({
        json: wrapResponse({ ...mockPost, description: `${mockPost.description} `.repeat(80) }),
      })
  );
  await mockComments(
    page,
    Array.from({ length: COMMENT_COUNT }, (_, index) => ({
      ...mockComment,
      id: commentId(index),
      content: `Comment ${index}\n\n${'Long comment line. '.repeat(10)}`,
    }))
  );
}

const commentIconLink = (page: Page) =>
  page.locator(`a[href="/post/${mockPost.id}${COMMENT_SECTION_HASH}"]`);

/** 댓글 영역 제목("댓글 N")이 sticky navbar 바로 아래에 왔는지 - 컨테이너의 scroll-mt-(--navbar-height).
 * #comments는 DOM id가 아니라 CommentList가 ref로 찾는 신호라 제목으로 잰다 */
async function expectCommentSectionAtTop(page: Page): Promise<void> {
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
}

async function expectArrivedAtCommentForm(page: Page): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}${COMMENT_SECTION_HASH}$`));
  await expectCommentSectionAtTop(page);
  await expect(page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder)).toBeFocused();
}

test.describe('카드 댓글 아이콘 — 상세의 댓글 작성 폼으로 스크롤', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockTallPostDetail(page);
  });

  test('피드에서 누르면 작성 폼이 navbar 바로 아래로 오고 입력창에 포커스된다', async ({
    page,
  }) => {
    await page.goto('/post');
    await commentIconLink(page).click();

    await expectArrivedAtCommentForm(page);
  });

  test('북마크 페이지에서 눌러도 같다', async ({ page }) => {
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
    await page.goto('/bookmark');
    await commentIconLink(page).click();

    await expectArrivedAtCommentForm(page);
  });

  test('상세 카드에서 누르면 폼으로 가고, 돌아가기 한 번에 피드로 간다(replace)', async ({
    page,
  }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page.locator('button', { hasText: TEXTS.post.detail.backToList })).toBeVisible();

    // 같은 글 안의 이동이라 ScrollRestoration이 맨 위로 올렸다 내려오면 안 된다
    // (preventScrollReset) - 누르기 직전 위치보다 위로 올라간 프레임이 없는지 본다.
    await commentIconLink(page).scrollIntoViewIfNeeded();
    const scrollYBeforeClick = await page.evaluate(() => window.scrollY);
    await page.evaluate(() => {
      const samples: number[] = [];
      (window as unknown as { __scrollSamples: number[] }).__scrollSamples = samples;
      const start = performance.now();

      function sample() {
        samples.push(window.scrollY);

        if (performance.now() - start < 1500) {
          requestAnimationFrame(sample);
        }
      }

      requestAnimationFrame(sample);
    });

    await commentIconLink(page).click();
    await expectArrivedAtCommentForm(page);

    const lowestScrollY = await page.evaluate(() =>
      Math.min(...(window as unknown as { __scrollSamples: number[] }).__scrollSamples)
    );
    expect(lowestScrollY).toBeGreaterThanOrEqual(scrollYBeforeClick - 1);

    // 라벨은 묻지 않는다(REPLACE면 state가 비어 "뒤로가기", 같은 경로 PUSH면 오버레이로 보고
    // "목록으로" 유지 - usePostDetail.ts useBackLabel). 한 번 눌러 피드로 가는지만 본다 -
    // PUSH였다면 같은 글(/post/:id)로 돌아간다.
    await page
      .locator('button', {
        hasText: new RegExp(`${TEXTS.post.detail.backToList}|${TEXTS.buttons.back}`),
      })
      .click();

    await expect(page).toHaveURL(/\/post$/);
  });

  test('도착 후 오버레이를 열었다 닫아도 폼으로 다시 끌려가지 않는다', async ({ page }) => {
    await mockBookmarkFolderList(page);
    await page.goto('/post');
    await commentIconLink(page).click();
    await expectArrivedAtCommentForm(page);
    const commentFormScrollY = await page.evaluate(() => window.scrollY);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // 북마크 폴더 창은 해시 없이 push하고(useHistoryOverlay) 닫을 때 뒤로가기(POP)로 #comments
    // 엔트리에 돌아온다 - 해시가 되살아나도 이미 이동한 엔트리라 다시 스크롤하면 안 된다.
    // 버튼이 카드 푸터에 있어 click()이 먼저 조금 스크롤하므로, 기준은 0이 아니라 창을 연 시점이다.
    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const scrollYBeforeClose = await page.evaluate(() => window.scrollY);
    // 창을 연 위치가 폼 위치와 달라야 "다시 끌려갔는지"를 가릴 수 있다. click()이 버튼을 화면에
    // 넣으려고 스크롤하는 양은 글꼴 렌더링에 따라 달라 입력창이 화면에 보이는지로는 판단하지 않는다
    // (로컬 17px, CI에서는 입력창이 화면 안으로 들어올 만큼 내려가 그 단정이 실패했다)
    expect(Math.abs(scrollYBeforeClose - commentFormScrollY)).toBeGreaterThan(100);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${COMMENT_SECTION_HASH}$`));

    // 부드러운 스크롤이 시작될 틈을 준 뒤 확인한다 - 회귀면 이 사이에 폼 쪽으로 내려간다
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollYBeforeClose);
  });

  test('#comment-<id>로 들어오면 기존처럼 그 댓글로 스크롤하고 링이 잠시 뒤 사라진다', async ({
    page,
  }) => {
    const target = commentId(HASHED_COMMENT_INDEX);
    await page.goto(`/post/${mockPost.id}#comment-${target}`);

    const comment = page.locator(`#comment-${target}`);
    await expect(comment).toBeInViewport();
    await expect(comment).toHaveClass(/ring-2/);
    await expect(page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder)).not.toBeFocused();

    // e2e는 dev 서버(StrictMode)라 effect가 두 번 돈다 - 두 번째는 엔트리 가드가 건너뛰므로 첫
    // 실행의 해제 타이머가 cleanup에 취소되면 링이 계속 남는다(CommentList.tsx 주석).
    await expect(comment).not.toHaveClass(/ring-2/, { timeout: 3000 });
  });
});
