import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListWithCommentCount } from './mocks/post.mock';
import { holdComments, mockComments } from './mocks/comment.mock';
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

function makeComments() {
  return Array.from({ length: COMMENT_COUNT }, (_, index) => ({
    ...mockComment,
    id: commentId(index),
    content: `Comment ${index}\n\n${'Long comment line. '.repeat(10)}`,
  }));
}

/** 나중에 등록한 목이 먼저 쓰이므로 beforeEach의 상세 응답을 덮는다 */
async function mockPostDetailWithCommentCount(page: Page, commentCount: number): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    (route) =>
      route.fulfill({
        json: wrapResponse({
          ...mockPost,
          description: `${mockPost.description} `.repeat(80),
          stats: { ...mockPost.stats, commentCount },
        }),
      })
  );
}

async function mockTallPostDetail(page: Page): Promise<void> {
  await mockPostDetailWithCommentCount(page, mockPost.stats.commentCount);
  await mockComments(page, makeComments());
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
    await mockPostListWithCommentCount(page, COMMENT_COUNT);
    await mockTallPostDetail(page);
  });

  // 링크 안에 버튼을 두면 이름이 숫자뿐이고 Tab이 두 번 멈췄다(HTML 표준은 a 안에 상호작용 요소를 금지한다)
  test('댓글 링크는 개수를 담은 이름으로 읽히고 안에 버튼이 없어 Tab이 한 번만 멈춘다', async ({
    page,
  }) => {
    await page.goto('/post');

    const link = commentIconLink(page);

    await expect(link).toHaveAccessibleName(TEXTS.ariaLabels.commentWithCount(COMMENT_COUNT));
    await expect(link.locator('button')).toHaveCount(0);

    await link.focus();
    await page.keyboard.press('Tab');
    await expect(link).not.toBeFocused();
    await expect(page.locator('a[href$="#comments"] :focus')).toHaveCount(0);
  });

  test('피드에서 누르면 작성 폼이 navbar 바로 아래로 오고 입력창에 포커스된다', async ({
    page,
  }) => {
    await page.goto('/post');
    await commentIconLink(page).click();

    await expectArrivedAtCommentForm(page);
  });

  // 숫자가 0이면 hover가 빈 목록을 심어 짧은 문서에서 먼저 스크롤한다 - 상세 숫자까지 옛값이면 자리를 잡을
  // 수 없어, 댓글이 도착해 문서가 길어질 때 다시 맞춰야 제목이 navbar 아래까지 온다(CommentList.tsx realignAfterSeedRefetch)
  test('피드·상세 숫자가 모두 옛값(0)이어도 댓글이 도착하면 작성 폼이 navbar 바로 아래로 온다', async ({
    page,
  }) => {
    await mockPostListWithCommentCount(page, 0);
    await page.goto('/post');
    await commentIconLink(page).click();

    await expectArrivedAtCommentForm(page);
  });

  // 피드를 보는 사이 댓글이 달린 글이다. 상세 응답의 최신 숫자로 댓글이 오는 중임을 알아, 빈 안내를 띄우지
  // 않고 뼈대로 자리를 잡아 응답 전에 스크롤을 끝낸다(useCommentList.ts isAwaitingComments)
  test('피드 숫자만 옛값(0)이면 응답 전에 최신 숫자가 보이고 빈 안내 없이 폼까지 오며, 늦으면 뼈대가 드러난다', async ({
    page,
  }) => {
    const heading = page.locator('h2', { hasText: TEXTS.comment.list.heading });
    const skeleton = page.locator('[aria-busy="true"]');

    await mockPostListWithCommentCount(page, 0);
    await mockPostDetailWithCommentCount(page, COMMENT_COUNT);
    const releaseComments = await holdComments(page, makeComments());
    await page.goto('/post');
    await commentIconLink(page).click();

    await expectArrivedAtCommentForm(page);
    await expect(heading).toContainText(String(COMMENT_COUNT));
    await expect(page.getByText(TEXTS.comment.list.empty)).toHaveCount(0);
    await expect(skeleton).toBeVisible();

    // 기다리는 사이 직접 더 내려 읽고 있었다면 댓글이 도착해도 끌려 올라가지 않는다
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'instant' }));
    const scrolledY = await page.evaluate(() => window.scrollY);
    releaseComments();

    await expect(page.getByText('Comment 0', { exact: false }).first()).toBeVisible();
    await expect(skeleton).toHaveCount(0);
    await expect(heading).toContainText(String(COMMENT_COUNT));

    // 부드러운 스크롤이 시작될 틈을 준 뒤 확인한다 - 회귀면 이 사이에 폼 쪽으로 올라간다
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolledY);
  });

  // 북마크 픽스처는 숫자가 0이라 위 테스트처럼 옛값인 글을 지난다
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

  test('#comment-<id>로 들어오면 기존처럼 그 댓글로 스크롤하고 배경 강조가 잠시 뒤 사라진다', async ({
    page,
  }) => {
    const target = commentId(HASHED_COMMENT_INDEX);
    await page.goto(`/post/${mockPost.id}#comment-${target}`);

    const comment = page.locator(`#comment-${target}`);
    await expect(comment).toBeInViewport();
    await expect(comment).toHaveClass(/\bbg-accent\b/);
    await expect(page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder)).not.toBeFocused();

    // e2e는 dev 서버(StrictMode)라 effect가 두 번 돈다 - 두 번째는 엔트리 가드가 건너뛰므로 첫
    // 실행의 해제 타이머가 cleanup에 취소되면 강조가 계속 남는다(CommentList.tsx 주석). 배경은
    // 1.6초에 빠지고, 페이드용 클래스(ring-8)는 600ms 더 지나 정리 타이머가 뗀다.
    await expect(comment).not.toHaveClass(/\bbg-accent\b/, { timeout: 3000 });
    await expect(comment).not.toHaveClass(/\bring-8\b/, { timeout: 3000 });
  });

  test('기기에서 동작 줄이기를 켰으면 미끄러지지 않고 바로 폼으로 간다', async ({ page }) => {
    // ScrollUtil.getBehavior()가 prefers-reduced-motion: reduce면 'auto'(즉시)를 준다
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/post');
    await expect(commentIconLink(page)).toBeVisible();
    await page.evaluate(() => {
      const samples: number[] = [];
      (window as unknown as { __scrollSamples: number[] }).__scrollSamples = samples;
      const start = performance.now();

      function sample() {
        samples.push(Math.round(window.scrollY));

        if (performance.now() - start < 2000) {
          requestAnimationFrame(sample);
        }
      }

      requestAnimationFrame(sample);
    });

    await commentIconLink(page).click();
    await expectArrivedAtCommentForm(page);
    await page.waitForTimeout(500);

    // 맨 위(0)와 도착 위치 사이의 중간 위치가 한 프레임도 없어야 한다
    const samples = await page.evaluate(
      () => (window as unknown as { __scrollSamples: number[] }).__scrollSamples
    );
    const arrivedY = samples[samples.length - 1]!;
    expect(arrivedY).toBeGreaterThan(0);
    expect(samples.filter((y) => y !== 0 && y !== arrivedY)).toEqual([]);
  });
});
