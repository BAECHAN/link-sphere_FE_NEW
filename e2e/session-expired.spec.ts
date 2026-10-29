import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { mockPost, mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import type { Locator, Page, Route } from '@playwright/test';

// 로그인 만료 = 액세스 토큰이 만료돼(TOKEN_EXPIRED) refresh를 시도했는데 refresh 쿠키까지 만료돼 BE가 401로 거절한 경우다
// (client.ts handleTokenExpired). 화면을 떠나지 않고 그 자리에서 다시 로그인하게 한다
// (docs/plans/2026-10-28-keep-writing-in-place.md, AuthUtil.applySessionExpired).

const VALID_PASSWORD = 'TestPass1!';
const COMMENT_PATH = /^\/api\/post\/[^/]+\/comment$/;
const NEW_URL = 'https://newlink.example.com/article';
const NEW_POST = { ...mockPost, id: 'post-uuid-new', url: NEW_URL, title: '새로 등록한 링크' };

function fulfillUnauthorized(route: Route, code: string) {
  return route.fulfill({
    status: 401,
    json: { status: 401, code, message: 'unauthorized', timestamp: new Date().toISOString() },
  });
}

/** 부트스트랩 refresh만 성공하고 그 뒤 refresh는 BE처럼 401로 거절한다 - refresh 쿠키까지 만료된 상황 */
async function mockRefreshExpiresAfterBootstrap(page: Page) {
  let refreshCalls = 0;
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.refresh),
    (route) => {
      refreshCalls += 1;

      if (refreshCalls === 1) {
        return route.fulfill({ json: wrapResponse(mockLoginResponse) });
      }

      return fulfillUnauthorized(route, 'INVALID_REFRESH_TOKEN');
    }
  );
}

/** 이 화면 위에 열린 로그인 창에서 다시 로그인한다(useLoginDialog가 성공을 보고 창을 닫는다) */
async function signInFromDialog(page: Page, dialog: Locator) {
  await dialog.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
  await dialog.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
  // dialog.tsx의 열린 직후 클릭 가드 - 위 fill 두 번이 그 시간을 채운다는 보장이 없다(protected-nav.spec.ts 선례)
  await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
  await dialog.getByRole('button', { name: TEXTS.auth.login.signIn, exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function expectNoErrorToast(page: Page) {
  await expect(page.getByText(TEXTS.messages.error.loginRequired)).toHaveCount(0);
  await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);
}

test.describe('로그인 만료', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockRefreshExpiresAfterBootstrap(page);
    await mockLoginSuccess(page);
    await mockCategoryOptions(page);
  });

  test('공개 화면에서 보기만 하던 중 만료되면 그 자리에 두고, 닫을 때까지 남는 안내의 버튼으로 다시 로그인한다', async ({
    page,
  }) => {
    await mockPostList(page);
    // 첫 계정 조회만 액세스 토큰 만료로 돌아온다 - 다시 로그인한 뒤 조회는 성공한다
    let accountCalls = 0;
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.account),
      (route) => {
        accountCalls += 1;

        if (accountCalls === 1) {
          return fulfillUnauthorized(route, SERVER_ERROR_CODE.TOKEN_EXPIRED);
        }

        return route.fulfill({ json: wrapResponse(mockAccount) });
      }
    );

    await page.goto('/post');

    const expiredToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: TEXTS.messages.info.sessionExpired });
    await expect(expiredToast).toBeVisible();
    // 로그인 페이지로 보내지 않는다 - 비로그인으로 다시 불러온 목록이 그대로 보인다
    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toHaveCount(0);
    await expectNoErrorToast(page);

    await expiredToast.getByRole('button', { name: TEXTS.buttons.login }).click();

    const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.expired.title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(TEXTS.auth.guard.expired.description)).toBeVisible();

    await signInFromDialog(page, dialog);

    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    await expect(page.getByText(TEXTS.messages.info.sessionExpired)).toHaveCount(0);
    await expect(page).toHaveURL(/\/post$/);
  });

  test('공개 화면에서 댓글을 저장할 때 만료되면 그 자리에 로그인 창을 띄우고, 다시 로그인하면 되돌린 입력으로 이어서 등록한다', async ({
    page,
  }) => {
    await mockAccountQuery(page);
    await mockPostDetail(page);
    let commentPosts = 0;
    await page.route(
      (url) => COMMENT_PATH.test(url.pathname),
      (route) => {
        if (route.request().method() !== 'POST') {
          return route.fulfill({ json: wrapResponse(commentPosts > 1 ? [mockComment] : []) });
        }

        commentPosts += 1;

        if (commentPosts === 1) {
          return fulfillUnauthorized(route, SERVER_ERROR_CODE.TOKEN_EXPIRED);
        }

        return route.fulfill({ status: 201, json: wrapResponse(mockComment) });
      }
    );

    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { level: 3, name: mockPost.title })).toBeVisible();

    const commentInput = page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
    await commentInput.fill('만료 중에 쓴 댓글');
    await page.getByRole('button', { name: TEXTS.comment.form.submitComment }).click();

    const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.expired.title });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));
    await expectNoErrorToast(page);
    // 저장하기 전에 비웠던 입력을 되돌리고, 로그아웃된 동안 폼 안에 안내를 띄운다
    await expect(commentInput).toHaveValue('만료 중에 쓴 댓글');
    await expect(page.getByText(TEXTS.messages.error.signedOutBeforeSave)).toBeVisible();

    await signInFromDialog(page, dialog);

    // 다시 로그인하면 안내는 사라지고 입력은 그대로다
    await expect(commentInput).toHaveValue('만료 중에 쓴 댓글');
    await expect(page.getByText(TEXTS.messages.error.signedOutBeforeSave)).toHaveCount(0);

    const created = page.waitForResponse(
      (response) =>
        COMMENT_PATH.test(new URL(response.url()).pathname) &&
        response.request().method() === 'POST' &&
        response.status() === 201
    );
    await page.getByRole('button', { name: TEXTS.comment.form.submitComment }).click();
    await created;

    await expect(page.getByText(mockComment.content)).toBeVisible();
    await expect(page.getByText(TEXTS.messages.error.signedOutBeforeSave)).toHaveCount(0);
  });

  test('보호 화면(/post/submit)에서 등록할 때 만료되면 그 자리에 로그인 창을 띄우고, 다시 로그인하면 입력한 그대로 등록한다', async ({
    page,
  }) => {
    await mockAccountQuery(page);
    let postCreates = 0;
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.post.base),
      (route) => {
        if (route.request().method() !== 'POST') {
          return route.fulfill({ json: wrapResponse(mockPostListResponse) });
        }

        postCreates += 1;

        if (postCreates === 1) {
          return fulfillUnauthorized(route, SERVER_ERROR_CODE.TOKEN_EXPIRED);
        }

        return route.fulfill({ json: wrapResponse(NEW_POST) });
      }
    );

    await page.goto('/post/submit');
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다
    const urlInput = page.getByLabel(/^URL/);
    await urlInput.fill(NEW_URL);
    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.expired.title });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/post\/submit$/);
    await expectNoErrorToast(page);
    await expect(page.getByText(TEXTS.messages.error.signedOutBeforeSave)).toBeVisible();

    await signInFromDialog(page, dialog);

    await expect(page).toHaveURL(/\/post\/submit$/);
    await expect(urlInput).toHaveValue(NEW_URL);
    await expect(page.getByText(TEXTS.messages.error.signedOutBeforeSave)).toHaveCount(0);

    await page.getByRole('button', { name: TEXTS.post.form.create.submit }).click();

    await expect(page).toHaveURL(/\/post$/);
    expect(postCreates).toBe(2);
    await expect(page.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title })).toHaveCount(
      0
    );
  });
});

// 앱을 열 때 지난번 로그인이 끝나 있었다 = 세션 플래그(auth.fixture)가 있는데 부트스트랩 refresh부터 401로 거절된다
// (useAppInitialization → AuthUtil.notifySessionExpiredOnStart, docs/AUTH.md §8-C)
test.describe('앱을 열 때 로그인 만료', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.refresh),
      (route) => fulfillUnauthorized(route, 'INVALID_REFRESH_TOKEN')
    );
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('공개 화면이면 닫을 때까지 남는 안내를 띄우고, 그 버튼은 기본 로그인 창을 연다', async ({
    page,
  }) => {
    await page.goto('/post');

    const expiredToast = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: TEXTS.messages.info.sessionExpired });
    await expect(expiredToast).toBeVisible();
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await expectNoErrorToast(page);

    await expiredToast.getByRole('button', { name: TEXTS.buttons.login }).click();

    // 막 연 앱에는 이어서 할 작업이 없다 - 만료 문구 창이 아니라 내비게이션 바 [로그인]과 같은 창이다
    const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
    await expect(dialog).toBeVisible();

    await signInFromDialog(page, dialog);

    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    await expect(page.getByText(TEXTS.messages.info.sessionExpired)).toHaveCount(0);
    await expect(page).toHaveURL(/\/post$/);
  });

  test('보호 화면이면 안내 없이 기본 로그인 창만 띄운다', async ({ page }) => {
    await page.goto('/post/submit');

    await expect(page.getByRole('dialog', { name: TEXTS.auth.guard.title })).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByText(TEXTS.messages.info.sessionExpired)).toHaveCount(0);
  });
});
