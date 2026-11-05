import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockOtherAccount } from '@/mocks/fixtures/account.fixtures';
import type { Comment } from '@/entities/comment/model/comment.schema';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// handleCommentDeleteSuccess(comment.keys.ts)는 댓글목록·게시글상세·게시글목록 3개
// 캐시를 invalidate한다. 낙관적 레이어가 없어(comment.queries.ts) 화면 반영은 전부
// 재조회로만 일어나므로, 이 스펙은 GET들을 상태를 갖는 로컬 핸들러로 재정의한다.
function setupRoutes(page: Page, before: Comment[], after: Comment[], commentCount: number) {
  let deleted = false;
  const comments = () => (deleted ? after : before);
  const post = () => ({ ...mockPost, stats: { ...mockPost.stats, commentCount } });

  return Promise.all([
    page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({
          json: wrapResponse({ ...mockPostListResponse, content: [post()] }),
        })
    ),
    page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => route.fulfill({ json: wrapResponse(post()) })
    ),
    page.route(
      (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
      (route) => route.fulfill({ json: wrapResponse(comments()) })
    ),
    // DELETE /comment/:id — GET 댓글목록(/post/:id/comment)과 pathname 형태가 완전히
    // 달라(세그먼트 위치가 다름) route.fallback 없이 단독 등록 가능하다. /comment/:id/like,
    // /comment/:id/reply도 세그먼트가 하나 더 있어 안 겹친다.
    page.route(
      (url) => /^\/api\/comment\/[^/]+$/.test(url.pathname),
      (route) => {
        deleted = true;
        return route.fulfill({ status: 204 });
      }
    ),
  ]);
}

test.describe('댓글 삭제', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner 판정(CommentItem.tsx) + Navbar 양쪽에 필수.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
  });

  test('답글 없는 댓글을 삭제하면 상세·목록·댓글목록 3개 캐시가 줄어든다', async ({ page }) => {
    await setupRoutes(page, [mockComment], [], 0);

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    const deleteButton = page.getByRole('button', { name: TEXTS.buttons.delete });
    await expect(deleteButton).toHaveCount(1);
    await deleteButton.click();

    // 트리거 버튼과 confirm 확인 버튼이 둘 다 role=button + 텍스트 '삭제'라 alertdialog로
    // 스코프해야 한다. confirm에 title이 없어 접근명은 sr-only 'Alert'다(Alert.tsx).
    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    // 삭제 버튼을 직접 눌러야만 뜨는 다이얼로그라 이미 삭제를 결심한 상태다 - 열리자마자
    // 삭제 버튼에 포커스가 가 있어야 한다(useDeleteComment.ts, § 2026-09-29).
    await expect(confirmDialog.getByRole('button', { name: TEXTS.buttons.delete })).toBeFocused();

    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 클릭 자체를 삼키므로
    // waitForResponse 같은 관측 가능한 이벤트로 대체할 수 없다(bookmark.spec.ts 선례).
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    const detailRefetch = page.waitForResponse(
      (res) => /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) && res.status() === 200
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();

    await expect(page.getByText(TEXTS.comment.list.empty)).toBeVisible();
    // <h2>댓글<span>{count}</span></h2> — 문자열 사이에 공백이 없어 접근명은 '댓글0'(실측).
    await expect(page.getByRole('heading', { level: 2, name: '댓글0' })).toBeVisible();
    await expect(page.getByText(TEXTS.messages.success.commentDeleted)).toBeVisible();

    const detailBody = await (await detailRefetch).json();
    expect(detailBody.data.stats.commentCount).toBe(0);

    const listRefetch = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.status() === 200
    );
    await page.getByRole('button', { name: TEXTS.post.detail.backToList }).click();
    await expect(page).toHaveURL(/\/post$/);
    const listBody = await (await listRefetch).json();
    expect(listBody.data.content[0].stats.commentCount).toBe(0);
  });

  test('답글 있는 댓글을 삭제하면 톰스톤으로 남고 액션 행이 사라지며 카운트는 그대로다', async ({
    page,
  }) => {
    const reply: Comment = {
      ...mockComment,
      id: 'comment-uuid-2',
      content: '답글입니다',
      author: { id: mockOtherAccount.id, nickname: mockOtherAccount.nickname, image: null },
    };
    const before: Comment[] = [{ ...mockComment, replies: [reply] }];
    const after: Comment[] = [
      { ...mockComment, isDeleted: true, content: '삭제된 댓글입니다.', replies: [reply] },
    ];
    // BE는 답글이 있으면 하드 삭제 대신 soft delete(톰스톤)로 처리한다 — countComments가
    // 톰스톤도 세므로(CommentList.tsx) 2(부모+답글)는 삭제 전후로 그대로다.
    await setupRoutes(page, before, after, 2);

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    const deleteButton = page.getByRole('button', { name: TEXTS.buttons.delete });
    await expect(deleteButton).toHaveCount(1);
    await deleteButton.click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();

    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 클릭 자체를 삼키므로
    // waitForResponse 같은 관측 가능한 이벤트로 대체할 수 없다(bookmark.spec.ts 선례).
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    const commentRefetch = page.waitForResponse(
      (res) =>
        /^\/api\/post\/[^/]+\/comment$/.test(new URL(res.url()).pathname) && res.status() === 200
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();
    await commentRefetch;

    await expect(page.getByText('삭제된 댓글입니다.')).toBeVisible();
    // 행이 톰스톤으로 남아도 삭제는 성공한 것이라 같은 성공 토스트가 뜬다.
    await expect(page.getByText(TEXTS.messages.success.commentDeleted)).toBeVisible();
    // 액션 행(좋아요/답글/수정/삭제) 전체가 사라진다 — isDeleted가 true면
    // CommentItem.tsx가 그 행 자체를 렌더하지 않는다.
    await expect(page.getByRole('button', { name: TEXTS.buttons.delete })).toHaveCount(0);
    await expect(page.getByRole('button', { name: TEXTS.comment.item.edit })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: '댓글2' })).toBeVisible();
    // 답글 본문은 그대로 남아있다.
    await expect(page.getByText('답글입니다')).toBeVisible();
  });

  // 글 작성자가 글을 지우면 내 댓글도 함께 사라진다(comments.post_id FK cascade). 이때는 댓글 목록 재조회도
  // 404라 캐시가 그대로 남으므로, 정보 안내와 함께 캐시에서 직접 빼야 그 댓글이 화면에서 사라진다.
  test('글이 함께 지워져 이미 없는 댓글이면(404) 정보 안내만 뜨고 댓글이 빠진다', async ({
    page,
  }) => {
    await setupRoutes(page, [mockComment], [], 1);

    let goneOnServer = false;
    const notFound = (code: string) => ({
      status: 404,
      json: { status: 404, code, message: 'gone', timestamp: new Date().toISOString() },
    });

    // LIFO라 setupRoutes의 핸들러보다 먼저 탄다
    await page.route(
      (url) => /^\/api\/comment\/[^/]+$/.test(url.pathname),
      (route) => {
        goneOnServer = true;

        return route.fulfill(notFound('COMMENT_NOT_FOUND'));
      }
    );
    await page.route(
      (url) => /^\/api\/post\/[^/]+(\/comment)?$/.test(url.pathname),
      (route) => (goneOnServer ? route.fulfill(notFound('POST_NOT_FOUND')) : route.fallback())
    );

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.buttons.delete }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();

    await expect(page.getByText(TEXTS.messages.info.commentAlreadyDeleted)).toBeVisible();
    await expect(page.getByText(TEXTS.comment.list.empty)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.success.commentDeleted)).toHaveCount(0);
    await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);
  });

  test('응답이 끊기면 한 번 더 보내고, 첫 요청이 지웠으면(404) 이미 삭제 안내만 뜬다', async ({
    page,
  }) => {
    await setupRoutes(page, [mockComment], [], 1);

    let deleteCount = 0;

    // LIFO라 setupRoutes의 핸들러보다 먼저 탄다
    await page.route(
      (url) => /^\/api\/comment\/[^/]+$/.test(url.pathname),
      (route) => {
        deleteCount += 1;

        return deleteCount === 1
          ? route.abort('failed')
          : route.fulfill({
              status: 404,
              json: {
                status: 404,
                code: 'COMMENT_NOT_FOUND',
                message: 'gone',
                timestamp: new Date().toISOString(),
              },
            });
      }
    );
    await page.route(
      (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
      (route) => (deleteCount > 0 ? route.fulfill({ json: wrapResponse([]) }) : route.fallback())
    );

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.buttons.delete }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();

    await expect(page.getByText(TEXTS.messages.info.commentAlreadyDeleted)).toBeVisible();
    await expect(page.getByText(TEXTS.comment.list.empty)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);
    await expect(page.getByText(TEXTS.messages.error.deleteOutcomeUnknown)).toHaveCount(0);
    expect(deleteCount).toBe(2);
  });

  test('두 번 다 응답이 없으면 댓글을 두고 삭제됐는지 확인하지 못했다고 안내한다', async ({
    page,
  }) => {
    await setupRoutes(page, [mockComment], [], 1);

    let deleteCount = 0;

    // LIFO라 setupRoutes의 핸들러보다 먼저 탄다
    await page.route(
      (url) => /^\/api\/comment\/[^/]+$/.test(url.pathname),
      (route) => {
        deleteCount += 1;

        return route.abort('failed');
      }
    );

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.buttons.delete }).click();

    const confirmDialog = page.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();

    await expect(page.getByText(TEXTS.messages.error.deleteOutcomeUnknown)).toBeVisible();
    await expect(page.getByText(mockComment.content)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);
    expect(deleteCount).toBe(2);
  });
});
