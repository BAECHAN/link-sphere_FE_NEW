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

    // 트리거 버튼과 confirm 확인 버튼이 둘 다 role=button + 텍스트 '삭제'라 dialog로
    // 스코프해야 한다. confirm에 title이 없어 접근명은 sr-only 'Alert'다(Alert.tsx).
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();

    const detailRefetch = page.waitForResponse(
      (res) => /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) && res.status() === 200
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();

    await expect(page.getByText(TEXTS.comment.list.empty)).toBeVisible();
    // <h2>댓글<span>{count}</span></h2> — 문자열 사이에 공백이 없어 접근명은 '댓글0'(실측).
    await expect(page.getByRole('heading', { level: 2, name: '댓글0' })).toBeVisible();

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

    const confirmDialog = page.getByRole('dialog');
    const commentRefetch = page.waitForResponse(
      (res) =>
        /^\/api\/post\/[^/]+\/comment$/.test(new URL(res.url()).pathname) && res.status() === 200
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.delete }).click();
    await commentRefetch;

    await expect(page.getByText('삭제된 댓글입니다.')).toBeVisible();
    // 액션 행(좋아요/답글/수정/삭제) 전체가 사라진다 — isDeleted가 true면
    // CommentItem.tsx가 그 행 자체를 렌더하지 않는다.
    await expect(page.getByRole('button', { name: TEXTS.buttons.delete })).toHaveCount(0);
    await expect(page.getByRole('button', { name: TEXTS.comment.item.edit })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: '댓글2' })).toBeVisible();
    // 답글 본문은 그대로 남아있다.
    await expect(page.getByText('답글입니다')).toBeVisible();
  });
});
