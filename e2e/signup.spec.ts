import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockEmailAvailability, mockSignUpSuccess } from './mocks/auth.mock';
import { mockNicknameAvailability } from './mocks/account.mock';
import { TEXTS } from '@/shared/config/texts';

// zod passwordValidationSchema(auth.schema.ts) — 영문+숫자+특수문자 8자 이상, 20자 이하.
const VALID_PASSWORD = 'TestPass1!';

test.describe('회원가입', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
  });

  test('중복확인을 통과하고 가입하면 /auth/login으로 이동하고, 비로그인 상태라 로그인 폼이 그대로 뜬다', async ({
    page,
  }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    await mockSignUpSuccess(page);

    await page.goto('/auth/sign-up');
    await page.getByLabel(/^Nickname/).fill('newuser');

    const emailAvailabilityRequest = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === '/api/auth/email-availability' && req.method() === 'GET'
    );
    await page.getByLabel(/^Email/).fill('new@example.com');
    const emailReq = await emailAvailabilityRequest;
    expect(new URL(emailReq.url()).searchParams.get('email')).toBe('new@example.com');

    // 500ms 디바운스 + 300ms 지연 게이트가 끝난 뒤의 최종 상태만 확인한다(중간 "확인
    // 중이에요..." 상태는 타이밍 의존적이라 단언하지 않는다).
    await expect(page.getByText(TEXTS.auth.signup.emailAvailable)).toBeVisible();

    await page.getByLabel(/^Password/).fill(VALID_PASSWORD);
    await page.getByLabel(TEXTS.labels.confirmPassword).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    // auth.queries.ts의 onSuccess가 라우트 이동에 API 상수가 아니라 ROUTES_PATHS를 쓰는지
    // 고정하는 회귀 방지 지점 — 이 둘이 우연히 같은 문자열이라 지금은 어느 쪽을 써도
    // 통과하지만, API_BASES.auth가 바뀌면 API 상수 쪽만 깨진다.
    await expect(page).toHaveURL(/\/auth\/login$/);
    // 가입이 로그인 상태를 만들지 않는다 — GuestGuard가 튕겨내지 않고 로그인 폼이 그대로 뜬다.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel(/^Email/)).toBeVisible();
  });

  test('비밀번호 확인이 다르면 제출이 되지 않고 인라인 오류가 뜬다', async ({ page }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    // 가입 요청 자체를 모킹하지 않는다 - zod 검증이 제대로 막으면 요청이 아예 안 나가고,
    // 혹시 새서 catch-all(installCatchAll)이 잡아도 네트워크 실패 토스트만 뜰 뿐 아래에서
    // 확인하는 인라인 불일치 메시지("비밀번호가 일치하지 않아요")는 뜨지 않으므로 구분된다.

    await page.goto('/auth/sign-up');
    await page.getByLabel(/^Nickname/).fill('newuser');
    await page.getByLabel(/^Email/).fill('new@example.com');
    await expect(page.getByText(TEXTS.auth.signup.emailAvailable)).toBeVisible();

    await page.getByLabel(/^Password/).fill(VALID_PASSWORD);
    await page.getByLabel(TEXTS.labels.confirmPassword).fill(`${VALID_PASSWORD}x`);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    await expect(page.getByText(TEXTS.validation.passwordMismatch)).toBeVisible();
    // 가입 페이지에 그대로 남아있어야 한다(제출 성공 시에만 /auth/login으로 이동한다).
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
  });

  test('이미 가입된 이메일이면 디바운스 후 인라인 오류가 뜨고 가입 버튼이 잠긴다', async ({
    page,
  }) => {
    await mockEmailAvailability(page, false);
    await mockNicknameAvailability(page, true);

    await page.goto('/auth/sign-up');
    await page.getByLabel(/^Nickname/).fill('newuser');
    await page.getByLabel(/^Email/).fill('taken@example.com');

    await expect(page.getByText(TEXTS.auth.signup.emailDuplicate)).toBeVisible();
    await page.getByLabel(/^Password/).fill(VALID_PASSWORD);
    await expect(page.getByRole('button', { name: TEXTS.auth.signup.signUp })).toBeDisabled();
  });
});
