import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockEmailAvailability, mockSignUpFailure } from './mocks/auth.mock';
import { mockNicknameAvailability } from './mocks/account.mock';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// zod passwordValidationSchema(auth.schema.ts) — 영문+숫자+특수문자 8자 이상, 20자 이하.
const VALID_PASSWORD = 'TestPass1!';

// useUnsavedChangesGuard.ts — 회원가입(`/auth/sign-up`)은 GuestGuard 아래라 방문자가 항상
// 비로그인이다. useUnsavedChangesGuard.ts:8-12(isGuestOnlyPage)가 로그인·회원가입 페이지를
// 비로그인 예외에서 빼기 전에는 이 페이지에서 가드가 전혀 동작하지 않았다 — 이 파일은 그
// 예외 처리를 검증한다. e2e/unsaved-changes.spec.ts(로그인 상태의 댓글/게시글 폼)와 별개로,
// e2e/signup.spec.ts(회원가입 성공/실패 흐름 자체)와도 겹치지 않게 분리했다.
//
// "Sign In" 링크(useSignUp.ts의 onLoginLinkClick)는 이메일이 이미 가입된 것으로 확인됐을
// 때만 확인창을 생략한다 - 로그인하려는 의도가 그 경우에만 명확하기 때문이다. 그 외(단순
// 입력 중)엔 일반 네비게이션으로 흘러가 전역 가드가 뒤로가기와 동일하게 처리한다.
test.describe('회원가입 폼 이탈 확인', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
  });

  function guardDialog(page: Page) {
    return page.getByRole('alertdialog', { name: TEXTS.unsavedChanges.signup.title });
  }

  async function fillSignupForm(page: Page) {
    await page.getByPlaceholder(TEXTS.placeholders.nickname).fill('newuser');
    await page.getByPlaceholder(TEXTS.placeholders.email).fill('new@example.com');
    await page.getByPlaceholder(TEXTS.placeholders.password).fill(VALID_PASSWORD);
    await page.getByPlaceholder(TEXTS.placeholders.confirmPassword).fill(VALID_PASSWORD);
  }

  function loginLink(page: Page) {
    return page.getByRole('link', { name: TEXTS.auth.signup.signIn });
  }

  test('이메일 중복이 아니면 입력 중 Sign In 링크를 눌러도 확인창이 뜨고, "계속 가입하기"를 누르면 입력값이 유지된다', async ({
    page,
  }) => {
    await page.goto('/auth/sign-up');
    await fillSignupForm(page);

    await loginLink(page).click();

    await expect(guardDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    // 실수로 한 이탈 시도에도 안전한 선택지(계속 가입하기)가 눌리도록, 열리자마자 그
    // 버튼에 포커스가 가 있어야 한다(unsaved-changes.spec.ts와 동일 취지, § 2026-09-29).
    await expect(
      guardDialog(page).getByRole('button', { name: TEXTS.unsavedChanges.signup.cancel })
    ).toBeFocused();

    await guardDialog(page)
      .getByRole('button', { name: TEXTS.unsavedChanges.signup.cancel })
      .click();
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('new@example.com');
  });

  test('확인창에서 "나가기"를 누르면 실제로 로그인 페이지로 이동한다', async ({ page }) => {
    await page.goto('/auth/sign-up');
    await fillSignupForm(page);

    await loginLink(page).click();
    await expect(guardDialog(page)).toBeVisible();

    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 클릭 자체를 삼키므로
    // waitForResponse 같은 관측 가능한 이벤트로 대체할 수 없다(bookmark.spec.ts 선례).
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    await guardDialog(page)
      .getByRole('button', { name: TEXTS.unsavedChanges.signup.confirm })
      .click();

    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('이메일이 중복이면 Sign In 링크는 하나만 있고 확인창 없이 바로 이동한다', async ({
    page,
  }) => {
    await mockEmailAvailability(page, false);
    await mockNicknameAvailability(page, true);

    await page.goto('/auth/sign-up');
    await page.getByPlaceholder(TEXTS.placeholders.nickname).fill('newuser');
    await page.getByPlaceholder(TEXTS.placeholders.email).fill('taken@example.com');
    await expect(page.getByText(TEXTS.auth.signup.emailDuplicate)).toBeVisible();

    // 예전엔 중복 안내 옆에 별도 "Sign In" 링크가 하나 더 떴다 - 지금은 없어야 한다.
    await expect(loginLink(page)).toHaveCount(1);
    await loginLink(page).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toHaveCount(0);
  });

  test('아무것도 입력하지 않았으면 Sign In 링크는 확인창 없이 이동한다', async ({ page }) => {
    await page.goto('/auth/sign-up');

    await loginLink(page).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('dialog').or(page.getByRole('alertdialog'))).toHaveCount(0);
  });

  test('로그인 페이지에서 "Sign Up"으로 들어가 입력 후 뒤로가기하면 확인창이 뜨고, "계속 가입하기"를 누르면 입력값이 유지된다', async ({
    page,
  }) => {
    // goto('/auth/sign-up') 직입이 아니라 라우터 이동으로 들어가야 한다 - history state에
    // idx가 없으면 POP(뒤로가기) 시 blocker가 조용히 무시된다(e2e/unsaved-changes.spec.ts의
    // openDirtyDetail과 동일한 이유).
    await page.goto('/auth/login');
    await page.getByRole('link', { name: TEXTS.auth.login.signUp }).click();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    await fillSignupForm(page);
    await page.goBack();

    // POP은 브라우저가 먼저 움직이고 라우터가 뒤늦게 되돌린다 - 모달은 block 판정과 같은
    // 틱에 뜨므로 URL보다 먼저 단언해도 안전하다(unsaved-changes.spec.ts와 동일 패턴).
    await expect(guardDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    // 실수로 한 이탈 시도(뒤로가기)에도 안전한 선택지(계속 가입하기)가 눌리도록, 열리자마자
    // 그 버튼에 포커스가 가 있어야 한다(unsaved-changes.spec.ts와 동일 취지, § 2026-09-29).
    await expect(
      guardDialog(page).getByRole('button', { name: TEXTS.unsavedChanges.signup.cancel })
    ).toBeFocused();

    await guardDialog(page)
      .getByRole('button', { name: TEXTS.unsavedChanges.signup.cancel })
      .click();
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('new@example.com');
  });

  test('뒤로가기로 뜬 확인창에서 "나가기"를 누르면 실제로 이동한다', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByRole('link', { name: TEXTS.auth.login.signUp }).click();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    await fillSignupForm(page);
    await page.goBack();

    await expect(guardDialog(page)).toBeVisible();

    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 클릭 자체를 삼키므로
    // waitForResponse 같은 관측 가능한 이벤트로 대체할 수 없다(bookmark.spec.ts 선례).
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);

    await guardDialog(page)
      .getByRole('button', { name: TEXTS.unsavedChanges.signup.confirm })
      .click();

    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('가입 요청이 실패한 뒤 뒤로가기를 누르면 확인창이 다시 뜬다', async ({ page }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    await mockSignUpFailure(page);

    await page.goto('/auth/login');
    await page.getByRole('link', { name: TEXTS.auth.login.signUp }).click();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    await fillSignupForm(page);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    // 요청 실패 - 여전히 회원가입 페이지에 남아있어야 한다.
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    // useSignUp.ts의 onSubmit이 요청 직전에 clearNow()로 지웠던 키가, 실패로 isPending이
    // false로 돌아오면서(isDirty && !isPending) 다시 등록됐는지 확인한다.
    await page.goBack();
    await expect(guardDialog(page)).toBeVisible();
  });
});
