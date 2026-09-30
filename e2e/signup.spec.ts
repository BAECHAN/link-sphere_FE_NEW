import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockEmailAvailability, mockSignUpSuccess } from './mocks/auth.mock';
import { mockNicknameAvailability } from './mocks/account.mock';
import { TEXTS } from '@/shared/config/texts';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

// zod passwordValidationSchema(auth.schema.ts) — 영문+숫자+특수문자 8자 이상, 20자 이하.
const VALID_PASSWORD = 'TestPass1!';

test.describe('회원가입', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
  });

  test('중복확인을 통과하고 가입하면 메일함 확인 화면으로 전환되고, "로그인하러 가기"로 /auth/login에 갈 수 있다', async ({
    page,
  }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    await mockSignUpSuccess(page);

    await page.goto('/auth/sign-up');
    await page.getByLabel(`${TEXTS.labels.nickname}*`, { exact: true }).fill('newuser');

    const emailAvailabilityRequest = page.waitForRequest(
      (req) =>
        new URL(req.url()).pathname === '/api/auth/email-availability' && req.method() === 'GET'
    );
    await page.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('new@example.com');
    const emailReq = await emailAvailabilityRequest;
    expect(new URL(emailReq.url()).searchParams.get('email')).toBe('new@example.com');

    // 500ms 디바운스 + 300ms 지연 게이트가 끝난 뒤의 최종 상태만 확인한다(중간 "확인
    // 중이에요..." 상태는 타이밍 의존적이라 단언하지 않는다).
    await expect(page.getByText(TEXTS.auth.signup.emailAvailable)).toBeVisible();

    await page.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel(TEXTS.labels.confirmPassword).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    // 가입 성공 시 navigate가 아니라 "메일함을 확인해주세요" 상태로 전환된다(BE가 인증메일을
    // 자동 발송하므로, 이 화면 자체가 성공을 보여준다 - useSignUp.ts 참고). URL은 그대로 유지.
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    await expect(page.getByText(TEXTS.auth.signup.checkEmailTitle)).toBeVisible();
    await expect(page.getByLabel(`${TEXTS.labels.email}*`, { exact: true })).toHaveCount(0);

    // "로그인하러 가기" 버튼으로 로그인 페이지에 갈 수 있다 - 가입이 로그인 상태를 만들지는
    // 않으므로 GuestGuard가 튕겨내지 않고 로그인 폼이 그대로 뜬다.
    await page.getByRole('link', { name: TEXTS.auth.signup.goToLogin }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toHaveCount(0);
    // 방금 가입한 이메일이 로그인 폼에 미리 채워져 있어야 한다(location.state 전달,
    // useSignUp.ts의 postSignupLoginState → useLogin.ts).
    await expect(page.getByLabel(`${TEXTS.labels.email}*`, { exact: true })).toHaveValue(
      'new@example.com'
    );
  });

  test('비밀번호 확인이 다르면 제출이 되지 않고 인라인 오류가 뜬다', async ({ page }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    // 가입 요청 자체를 모킹하지 않는다 - zod 검증이 제대로 막으면 요청이 아예 안 나가고,
    // 혹시 새서 catch-all(installCatchAll)이 잡아도 네트워크 실패 토스트만 뜰 뿐 아래에서
    // 확인하는 인라인 불일치 메시지("비밀번호가 일치하지 않아요")는 뜨지 않으므로 구분된다.

    await page.goto('/auth/sign-up');
    await page.getByLabel(`${TEXTS.labels.nickname}*`, { exact: true }).fill('newuser');
    await page.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('new@example.com');
    await expect(page.getByText(TEXTS.auth.signup.emailAvailable)).toBeVisible();

    await page.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await page.getByLabel(TEXTS.labels.confirmPassword).fill(`${VALID_PASSWORD}x`);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    await expect(page.getByText(TEXTS.validation.passwordMismatch)).toBeVisible();
    // 가입 페이지에 그대로 남아있어야 한다(제출 성공 시에만 메일함 확인 화면으로 전환된다).
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
  });

  test('이미 가입된 이메일이면 디바운스 후 인라인 오류가 뜨고 가입 버튼이 잠긴다', async ({
    page,
  }) => {
    await mockEmailAvailability(page, false);
    await mockNicknameAvailability(page, true);

    await page.goto('/auth/sign-up');
    await page.getByLabel(`${TEXTS.labels.nickname}*`, { exact: true }).fill('newuser');
    await page.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('taken@example.com');

    await expect(page.getByText(TEXTS.auth.signup.emailDuplicate)).toBeVisible();
    await page.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await expect(page.getByRole('button', { name: TEXTS.auth.signup.signUp })).toBeDisabled();

    // 중복 확인된 이메일로 "Sign In" 링크를 누르면 확인창 없이 바로 이동하고(가드 예외,
    // signup-unsaved-changes.spec.ts에서 이미 검증), 로그인 폼에 그 이메일이 미리 채워진다.
    await page.getByRole('link', { name: TEXTS.auth.signup.signIn }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByLabel(`${TEXTS.labels.email}*`, { exact: true })).toHaveValue(
      'taken@example.com'
    );
  });

  test('저장된 이메일이 있어도 회원가입에서 방금 확인된 이메일이 우선한다', async ({ page }) => {
    // useLogin.ts는 location.state의 이메일을 저장된(localStorage) 이메일보다 우선한다 -
    // 방금 직접 입력하고 서버가 중복이라 확인해준 값이 지난 방문의 저장값보다 더 명확한
    // 의도이기 때문이다(auth.fixture.ts의 addInitScript 패턴 - LocalStorageUtil은 항상
    // JSON.stringify로 저장하므로 시딩도 JSON 문자열로 넣어야 한다).
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, JSON.stringify('old@example.com'));
    }, STORAGE_KEYS.AUTH.SAVED_EMAIL);

    await mockEmailAvailability(page, false);
    await mockNicknameAvailability(page, true);

    await page.goto('/auth/sign-up');
    await page.getByLabel(`${TEXTS.labels.nickname}*`, { exact: true }).fill('newuser');
    await page.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('taken@example.com');
    await expect(page.getByText(TEXTS.auth.signup.emailDuplicate)).toBeVisible();

    await page.getByRole('link', { name: TEXTS.auth.signup.signIn }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByLabel(`${TEXTS.labels.email}*`, { exact: true })).toHaveValue(
      'taken@example.com'
    );
  });
});
