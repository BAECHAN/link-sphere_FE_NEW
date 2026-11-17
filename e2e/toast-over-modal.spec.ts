import { test as baseTest, expect, type Locator, type Page } from '@playwright/test';
import { test as authTest } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh, mockLoginFailure, mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { isApiPath } from './mocks/route-match';
import { ENDPOINTS } from './mocks/endpoints';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// Radix 모달·확인창·메뉴는 열려 있는 동안 body에 pointer-events: none을 건다. sonner 토스트는 Radix 밖이라 그대로
// 물려받아, 모달 위에 보이면서도 버튼·X가 눌리지 않았다(클릭이 뒤의 딤에 떨어졌다). 토스터를 Radix Branch로 등록해
// 눌리게 하고, 눌러도 모달이 "바깥 클릭"으로 닫히지 않게 한다(docs/plans/2026-11-17-toast-over-modal.md).

const VALID_PASSWORD = 'TestPass1!';
// 고치기 전에는 클릭이 딤에 가로막힌다 - 기본 제한(30초)까지 기다리지 않게 줄인다
const CLICK_TIMEOUT_MS = 3000;

function toastWithText(page: Page, text: string): Locator {
  return page.locator('[data-sonner-toast]').filter({ hasText: text });
}

async function closeToast(toast: Locator) {
  await toast.locator('[data-close-button]').click({ timeout: CLICK_TIMEOUT_MS });
  await expect(toast).toBeHidden();
}

baseTest.describe('로그인 모달 위의 토스트', () => {
  baseTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockLoginFailure(page, 'invalid password');
  });

  baseTest(
    '입력이 있는 로그인 모달 위에서도 토스트의 X가 눌리고, 모달과 입력은 그대로 남는다',
    async ({ page }) => {
      await page.goto('/post');
      await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();

      const loginDialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
      await expect(loginDialog).toBeVisible();

      const email = loginDialog.getByLabel(`${TEXTS.labels.email}*`, { exact: true });
      await email.fill('test@example.com');
      await loginDialog
        .getByLabel(`${TEXTS.labels.password}*`, { exact: true })
        .fill(VALID_PASSWORD);
      // dialog.tsx의 열린 직후 클릭 가드 - 클릭 자체를 삼켜 시간 대기로만 넘길 수 있다(bookmark.spec.ts 선례)
      await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
      await loginDialog.getByRole('button', { name: TEXTS.auth.login.signIn, exact: true }).click();

      const failureToast = toastWithText(page, TEXTS.messages.error.loginFailedPasswordMismatch);
      await expect(failureToast).toBeVisible();

      await closeToast(failureToast);

      await expect(loginDialog).toBeVisible();
      await expect(email).toHaveValue('test@example.com');
    }
  );
});

authTest.describe('로그인 상태 — 모달·확인창·메뉴 위의 토스트', () => {
  authTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner(자물쇠 버튼 렌더)에 필수
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockBookmarkFolderList(page);
    await page.route(
      (url) => /^\/api\/post\/[^/]+\/visibility$/.test(url.pathname),
      (route) =>
        route.fulfill({
          status: 500,
          json: {
            status: 500,
            code: 'INTERNAL_SERVER_ERROR',
            message: 'error',
            timestamp: new Date().toISOString(),
          },
        })
    );
  });

  /** ⋮ 메뉴 → "나만 보기"로 공개 설정 확인창을 연다(mockPost는 공개 글이라 자물쇠 버튼이 없다) */
  async function openVisibilityConfirm(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: TEXTS.ariaLabels.postMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.post.card.privateLabel }).click();

    const confirmDialog = page.getByRole('alertdialog', {
      name: TEXTS.post.card.visibilityConfirmTitle,
    });
    await expect(confirmDialog).toBeVisible();

    return confirmDialog;
  }

  /** 닫을 때까지 남는 토스트를 띄운다 - 공개 설정 변경 실패(post.queries.ts, duration: Infinity) */
  async function raiseStickyToast(page: Page): Promise<Locator> {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    const confirmDialog = await openVisibilityConfirm(page);
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await confirmDialog
      .getByRole('button', { name: TEXTS.post.card.visibilityConfirmButtonToPrivate })
      .click();
    await expect(confirmDialog).toBeHidden();

    const stickyToast = toastWithText(page, TEXTS.messages.error.postVisibilityUpdateFailed);
    await expect(stickyToast).toBeVisible();

    return stickyToast;
  }

  authTest('입력이 없는 모달 위의 토스트를 눌러도 모달이 닫히지 않는다', async ({ page }) => {
    const stickyToast = await raiseStickyToast(page);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();
    // 가드 시간이 지나야 바깥 클릭이 모달을 닫는다 - 그 뒤에 눌러야 "닫히지 않는다"가 의미를 갖는다
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    await closeToast(stickyToast);

    await expect(folderDialog).toBeVisible();
  });

  authTest('확인창 위에서도 토스트의 X가 눌린다', async ({ page }) => {
    const stickyToast = await raiseStickyToast(page);

    const confirmDialog = await openVisibilityConfirm(page);

    await closeToast(stickyToast);

    await expect(confirmDialog).toBeVisible();
  });

  authTest(
    '드롭다운 메뉴가 열려 있어도 토스트의 X가 눌리고, 메뉴는 닫히지 않는다',
    async ({ page }) => {
      const stickyToast = await raiseStickyToast(page);

      await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
      const logOutItem = page.getByRole('menuitem', { name: TEXTS.nav.logOut });
      await expect(logOutItem).toBeVisible();

      await closeToast(stickyToast);

      await expect(logOutItem).toBeVisible();
    }
  );
});

authTest.describe('로그인 만료 안내 — 로그인 모달이 열린 동안 숨긴다', () => {
  authTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    // 지난 로그인이 끝나 있었다 - 세션 표시는 있는데 refresh가 401로 거절된다(AuthUtil.notifySessionExpiredOnStart)
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.refresh),
      (route) =>
        route.fulfill({
          status: 401,
          json: {
            status: 401,
            code: 'INVALID_REFRESH_TOKEN',
            message: 'unauthorized',
            timestamp: new Date().toISOString(),
          },
        })
    );
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  authTest(
    '모달이 열리면 사라지고, 로그인하지 않고 닫으면 다시 보이며, 로그인하면 보이지 않는다',
    async ({ page }) => {
      await page.goto('/post');
      await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

      const expiredToast = toastWithText(page, TEXTS.messages.info.sessionExpired);
      await expect(expiredToast).toBeVisible();

      await page
        .locator('nav')
        .getByRole('button', { name: TEXTS.buttons.login, exact: true })
        .click();
      const loginDialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
      await expect(loginDialog).toBeVisible();
      await expect(expiredToast).toHaveCount(0);

      await page.keyboard.press('Escape');
      await expect(loginDialog).toBeHidden();
      await expect(expiredToast).toBeVisible();

      await expiredToast.getByRole('button', { name: TEXTS.buttons.login }).click();
      await expect(loginDialog).toBeVisible();
      await expect(expiredToast).toHaveCount(0);

      await loginDialog
        .getByLabel(`${TEXTS.labels.email}*`, { exact: true })
        .fill('test@example.com');
      await loginDialog
        .getByLabel(`${TEXTS.labels.password}*`, { exact: true })
        .fill(VALID_PASSWORD);
      await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
      await loginDialog.getByRole('button', { name: TEXTS.auth.login.signIn, exact: true }).click();

      await expect(loginDialog).toBeHidden();
      await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
      await expect(expiredToast).toHaveCount(0);
    }
  );
});
