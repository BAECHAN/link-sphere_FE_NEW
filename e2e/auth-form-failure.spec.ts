import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockEmailAvailability } from './mocks/auth.mock';
import { mockNicknameAvailability } from './mocks/account.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { TEXTS } from '@/shared/config/texts';

// zod passwordValidationSchema(auth.schema.ts) — 영문+숫자+특수문자 8자 이상, 64자 이하.
const VALID_PASSWORD = 'TestPass1!';

// 실패 토스트가 사라진 뒤에도 폼이 실패를 보여 주는지(#491 4·5번)
test.describe('인증 폼 실패 뒤 상태', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
  });

  test('재설정 링크가 거절되면 폼 대신 새 링크를 요청하는 카드를 보여 준다', async ({ page }) => {
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.passwordResetConfirm),
      (route) =>
        route.fulfill({
          status: 400,
          json: { status: 400, code: 'INVALID_ACTION_TOKEN', message: '', timestamp: '' },
        })
    );

    await page.goto('/auth/reset-password?token=used-token');
    await page.getByLabel(`${TEXTS.labels.newPassword}*`, { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel(`${TEXTS.labels.confirmPassword}*`, { exact: true }).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: TEXTS.auth.resetPassword.submit }).click();

    await expect(page.getByText(TEXTS.auth.resetPassword.invalidTokenTitle)).toBeVisible();
    await expect(
      page.getByRole('link', { name: TEXTS.auth.resetPassword.requestNewLink })
    ).toBeVisible();
    await expect(page.getByLabel(`${TEXTS.labels.newPassword}*`, { exact: true })).toHaveCount(0);
  });

  test('확인 때 사용 가능했던 이메일이 제출 때 중복이면 칸 오류를 띄우고 가입 버튼을 막는다', async ({
    page,
  }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.signup),
      (route) =>
        route.fulfill({
          status: 409,
          json: { status: 409, code: 'DUPLICATE_MEMBER', message: '', timestamp: '' },
        })
    );

    await page.goto('/auth/sign-up');
    await page.getByLabel(`${TEXTS.labels.nickname}*`, { exact: true }).fill('newuser');
    await page.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('race@example.com');
    await expect(page.getByText(TEXTS.auth.signup.emailAvailable)).toBeVisible();
    await page.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel(TEXTS.labels.confirmPassword).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    await expect(page.getByText(TEXTS.auth.signup.emailDuplicate)).toBeVisible();
    await expect(page.getByText(TEXTS.auth.signup.emailAvailable)).toHaveCount(0);
    await expect(page.getByRole('button', { name: TEXTS.auth.signup.signUp })).toBeDisabled();
  });
});
