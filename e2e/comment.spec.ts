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
import { TEXTS } from '@/shared/config/texts';

test.describe('댓글 작성 → 목록 카운트 반영', () => {
  test('댓글을 작성하면 상세는 즉시, 목록은 재방문 시 댓글 수가 반영된다', async ({ page }) => {
    // 좋아요(캐시 직접 패치)와 반대로 댓글 생성은 invalidate 방식이다
    // (handleCommentCreateSuccess, comment.keys.ts:21-27) — 상세는 active 쿼리라
    // 즉시 재조회되고, 목록은 unmount 상태라 stale 마킹만 됐다가 복귀 시 재조회된다.
    // 이 스펙만 상태를 갖는 mock이 필요하다 — 고정값이면 "재조회가 실제로 최신값을
    // 반영했다"를 증명할 수 없다(처음부터 1이 찍혀 있어도 테스트가 못 걸러낸다).
    // 딱 이 한 곳에서만 쓰는 패턴이라 공용 헬퍼로 일반화하지 않고 스펙 로컬 클로저로 둔다.
    let commentCreated = false;

    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({
          json: wrapResponse({
            ...mockPostListResponse,
            content: mockPostListResponse.content.map((post) =>
              post.id === mockPost.id
                ? { ...post, stats: { ...post.stats, commentCount: commentCreated ? 1 : 0 } }
                : post
            ),
          }),
        })
    );
    await page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) =>
        route.fulfill({
          json: wrapResponse({
            ...mockPost,
            stats: { ...mockPost.stats, commentCount: commentCreated ? 1 : 0 },
          }),
        })
    );
    await page.route(
      (url) => /^\/api\/post\/[^/]+\/comment$/.test(url.pathname),
      (route) => {
        if (route.request().method() === 'POST') {
          commentCreated = true;
          return route.fulfill({ status: 201, json: wrapResponse(mockComment) });
        }
        return route.fulfill({ json: wrapResponse(commentCreated ? [mockComment] : []) });
      }
    );

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    await page
      .getByPlaceholder(TEXTS.comment.form.commentPlaceholder)
      .fill('정말 유용한 글이네요!');

    // invalidate가 트리거하는 재조회 응답을 직접 기다린다 — 역할(link/button)이
    // 중첩돼 있어 흔들릴 수 있는 댓글 수 UI 숫자를 읽는 대신, 실제로 재조회가
    // 일어나고 그 응답이 최신값을 담고 있는지를 네트워크 레벨에서 증명한다.
    const detailRefetch = page.waitForResponse(
      (res) => /^\/api\/post\/[^/]+$/.test(new URL(res.url()).pathname) && res.status() === 200
    );
    await page.getByRole('button', { name: TEXTS.comment.form.submitComment }).click();

    // useCreateCommentMutation의 onSuccess가 입력한 임시 댓글을 서버 응답(mockComment)으로
    // 치환한다(comment.queries.ts:108-113) — 실측 확인, 화면엔 mockComment.content가
    // 최종적으로 남는다.
    await expect(page.getByText(mockComment.content)).toBeVisible();

    const detailResBody = await (await detailRefetch).json();
    expect(detailResBody.data.stats.commentCount).toBe(1);

    const listRefetch = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.status() === 200
    );
    await page.getByRole('button', { name: TEXTS.post.detail.backToList }).click();
    await expect(page).toHaveURL(/\/post$/);

    const listResBody = await (await listRefetch).json();
    expect(listResBody.data.content[0].stats.commentCount).toBe(1);
  });
});
