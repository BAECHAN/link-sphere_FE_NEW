import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockComments } from './mocks/comment.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// useUpdatePostVisibilityMutation(post.queries.ts)은 direct patch 없이 invalidate만 한다
// (mutationKey도 update와 달라 '수정 중...' 오버레이/토스트에 안 걸림 — post-update.spec.ts와
// 독립). 화면 반영은 오직 재조회로만 일어나므로 이 스펙은 GET을 상태를 갖는 로컬
// 핸들러로 재정의한다. PATCH /post/:id/visibility는 세그먼트가 하나 더 있어 GET
// /post/:id와 pathname이 겹치지 않는다 — route.fallback 불필요.
function setupPostRoutes(page: Page, initialIsPrivate: boolean) {
  const state = { isPrivate: initialIsPrivate, lastBody: null as { isPrivate: boolean } | null };
  const current = () => ({ ...mockPost, isPrivate: state.isPrivate });

  return Promise.all([
    page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) =>
        route.fulfill({ json: wrapResponse({ ...mockPostListResponse, content: [current()] }) })
    ),
    page.route(
      (url) => /^\/api\/post\/[^/]+$/.test(url.pathname),
      (route) => route.fulfill({ json: wrapResponse(current()) })
    ),
    page.route(
      (url) => /^\/api\/post\/[^/]+\/visibility$/.test(url.pathname),
      (route) => {
        state.lastBody = route.request().postDataJSON();
        state.isPrivate = state.lastBody!.isPrivate;
        return route.fulfill({ json: wrapResponse({ ...mockPost, isPrivate: state.isPrivate }) });
      }
    ),
  ]).then(() => state);
}

test.describe('공개/비공개 전환', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner(⋮·자물쇠 버튼 렌더)에 필수.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    // 댓글은 이 스펙의 검증 대상이 아니다(like.spec.ts와 동일 이유).
    await mockComments(page, []);
  });

  test('⋮ 메뉴로 비공개 전환하면 재조회로만 반영되고, 목록에도 전파된다', async ({ page }) => {
    const state = await setupPostRoutes(page, false);

    await page.goto('/post');
    await page.getByRole('link', { name: mockPost.title }).click();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    // 목록 카드 title Link의 onFocus가 handlePrefetchDetail을 또 쏴 상세 진입 직후
    // GET /post/:id가 한 번 더 나가고, 그 응답이 Suspense와 겹치면 방금 연 드롭다운이
    // 즉시 닫힌다(post-delete.spec.ts에서 실측). 잔여 네트워크가 가라앉을 때까지 기다린다.
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    // mockPost.isPrivate === false라 첫 라벨은 '나만 보기'.
    await page.getByRole('menuitem', { name: TEXTS.post.card.privateLabel }).click();

    const confirmDialog = page.getByRole('dialog', {
      name: TEXTS.post.card.visibilityConfirmTitle,
    });
    await expect(confirmDialog).toBeVisible();

    const patched = page.waitForResponse((res) =>
      /^\/api\/post\/[^/]+\/visibility$/.test(new URL(res.url()).pathname)
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.confirm }).click();
    await patched;
    expect(state.lastBody).toEqual({ isPrivate: true });

    await expect(page.getByTitle(TEXTS.post.card.makePublic)).toBeVisible();
    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await expect(page.getByRole('menuitem', { name: TEXTS.post.card.publicLabel })).toBeVisible();

    // 목록으로 돌아가도 전파됐는지 확인 — invalidate로 stale 마킹된 목록이 재조회된다.
    const listRefetch = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/post' && res.status() === 200
    );
    await page.getByRole('button', { name: TEXTS.post.detail.backToList }).click();
    await expect(page).toHaveURL(/\/post$/);
    await listRefetch;
    await expect(page.getByTitle(TEXTS.post.card.makePublic)).toBeVisible();
  });

  test('자물쇠 버튼으로 전체 공개로 되돌린다', async ({ page }) => {
    const state = await setupPostRoutes(page, true);

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    const lockButton = page.getByTitle(TEXTS.post.card.makePublic);
    await expect(lockButton).toBeVisible();
    await lockButton.click();

    const confirmDialog = page.getByRole('dialog', {
      name: TEXTS.post.card.visibilityConfirmTitle,
    });
    const patched = page.waitForResponse((res) =>
      /^\/api\/post\/[^/]+\/visibility$/.test(new URL(res.url()).pathname)
    );
    await confirmDialog.getByRole('button', { name: TEXTS.buttons.confirm }).click();
    await patched;
    expect(state.lastBody).toEqual({ isPrivate: false });

    await expect(page.getByTitle(TEXTS.post.card.makePublic)).toHaveCount(0);
    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await expect(page.getByRole('menuitem', { name: TEXTS.post.card.privateLabel })).toBeVisible();
  });
});
