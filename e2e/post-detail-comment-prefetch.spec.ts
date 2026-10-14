import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { wrapResponse } from './mocks/wrap-response';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { COMMENT_SECTION_HASH } from '@/entities/comment/config/comment.const';
import { TEXTS } from '@/shared/config/texts';

// 상세 페이지는 게시글을 기다리는 경계 바깥에서 댓글 요청을 함께 시작한다(PostDetailPage의
// usePostDetailPrefetch) - 안쪽 CommentList는 게시글이 와야 마운트돼 그때서야 요청하던 순차
// 요청을 없앤 것이다. 카드의 댓글 아이콘은 hover·focus만으로 게시글과 댓글을 미리 받고, 제목
// 링크는 카드 전체를 덮어 지나가기만 해도 발동하므로 지금처럼 게시글만 받는다.
const POST_DETAIL_DELAY_MS = 1000;

interface RequestLog {
  postRequests: number;
  commentRequests: number;
  firstCommentRequestAt?: number;
  postResponseAt?: number;
}

async function mockDetailAndComments(page: Page, log: RequestLog): Promise<void> {
  await page.route(
    (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
    async (route) => {
      log.postRequests += 1;
      await new Promise((resolve) => setTimeout(resolve, POST_DETAIL_DELAY_MS));
      log.postResponseAt ??= Date.now();
      await route.fulfill({ json: wrapResponse(mockPost) });
    }
  );
  await page.route(
    (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
    (route) => {
      log.commentRequests += 1;
      log.firstCommentRequestAt ??= Date.now();

      return route.fulfill({ json: wrapResponse([mockComment]) });
    }
  );
}

test.describe('상세 댓글 요청 시점', () => {
  let log: RequestLog;

  test.beforeEach(async ({ page }) => {
    log = { postRequests: 0, commentRequests: 0 };
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockDetailAndComments(page, log);
  });

  test('상세에 들어가면 게시글 응답을 기다리지 않고 댓글을 요청하고, 한 번만 요청한다', async ({
    page,
  }) => {
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByText(mockComment.content)).toBeVisible();

    expect(log.firstCommentRequestAt).toBeDefined();
    expect(log.postResponseAt).toBeDefined();
    expect(log.firstCommentRequestAt!).toBeLessThan(log.postResponseAt!);
    // CommentList는 미리 받은 같은 키의 캐시를 읽는다 - 다시 요청하지 않는다
    expect(log.commentRequests).toBe(1);
  });

  test('카드의 댓글 아이콘에 마우스를 올리면 누르기 전에 게시글과 댓글을 미리 받는다', async ({
    page,
  }) => {
    await page.goto('/post');
    await page.locator(`a[href="/post/${mockPost.id}${COMMENT_SECTION_HASH}"]`).hover();

    await expect.poll(() => log.commentRequests).toBe(1);
    await expect.poll(() => log.postRequests).toBe(1);
    await expect(page).toHaveURL(/\/post$/);
  });

  test('카드 제목에 마우스를 올리면 지금처럼 게시글만 미리 받는다', async ({ page }) => {
    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).hover();

    await expect.poll(() => log.postRequests).toBe(1);
    // 댓글 요청이 뒤따라 나가지 않는지 잠시 지켜본다
    await page.waitForTimeout(500);
    expect(log.commentRequests).toBe(0);
    await expect(page.getByText(TEXTS.comment.list.heading)).toHaveCount(0);
  });
});
