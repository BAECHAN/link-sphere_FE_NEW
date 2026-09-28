import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockEmailAvailability, mockSignUpFailure } from './mocks/auth.mock';
import { mockNicknameAvailability } from './mocks/account.mock';
import { TEXTS } from '@/shared/config/texts';

// zod passwordValidationSchema(auth.schema.ts) — 영문+숫자+특수문자 8자 이상, 20자 이하.
const VALID_PASSWORD = 'TestPass1!';

// useUnsavedChangesGuard.ts — 회원가입(`/auth/sign-up`)은 GuestGuard 아래라 방문자가 항상
// 비로그인이다. useUnsavedChangesGuard.ts:8-12(isGuestOnlyPage)가 로그인·회원가입 페이지를
// 비로그인 예외에서 빼기 전에는 이 페이지에서 가드가 전혀 동작하지 않았다 — 이 파일은 그
// 예외 처리를 검증한다. e2e/unsaved-changes.spec.ts(로그인 상태의 댓글/게시글 폼)와 별개로,
// e2e/signup.spec.ts(회원가입 성공/실패 흐름 자체)와도 겹치지 않게 분리했다.
test.describe('회원가입 폼 이탈 확인', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
  });

  function guardDialog(page: Page) {
    return page.getByRole('dialog', { name: TEXTS.unsavedChanges.signup.title });
  }

  async function fillSignupForm(page: Page) {
    await page.getByPlaceholder(TEXTS.placeholders.nickname).fill('newuser');
    await page.getByPlaceholder(TEXTS.placeholders.email).fill('new@example.com');
    await page.getByPlaceholder(TEXTS.placeholders.password).fill(VALID_PASSWORD);
    await page.getByPlaceholder(TEXTS.placeholders.confirmPassword).fill(VALID_PASSWORD);
  }

  // 하단 "Sign In" 링크. 이메일이 중복일 때는 이메일 필드 바로 아래에 같은 텍스트의 링크가
  // 하나 더 생기는데(먼저 렌더됨), 이 링크는 항상 폼 맨 아래 CardFooter에 있어 DOM 순서상
  // 마지막이다.
  function footerLoginLink(page: Page) {
    return page.getByRole('link', { name: TEXTS.auth.signup.signIn }).last();
  }

  test('입력 후 "Sign In" → 확인창에서 "계속 가입하기"를 누르면 입력값이 그대로 남는다', async ({
    page,
  }) => {
    await page.goto('/auth/sign-up');
    await fillSignupForm(page);

    await footerLoginLink(page).click();
    await expect(guardDialog(page)).toBeVisible();
    await guardDialog(page)
      .getByRole('button', { name: TEXTS.unsavedChanges.signup.cancel })
      .click();

    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('new@example.com');
  });

  test('입력 후 "Sign In" → 확인창에서 "나가기"를 누르면 로그인 페이지로 이동한다', async ({
    page,
  }) => {
    await page.goto('/auth/sign-up');
    await fillSignupForm(page);

    await footerLoginLink(page).click();
    await expect(guardDialog(page)).toBeVisible();
    await guardDialog(page)
      .getByRole('button', { name: TEXTS.unsavedChanges.signup.confirm })
      .click();

    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('아무것도 입력하지 않고 "Sign In"을 누르면 확인창 없이 바로 이동한다', async ({ page }) => {
    await page.goto('/auth/sign-up');

    await footerLoginLink(page).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('로그인 페이지에서 "Sign Up"으로 들어가 입력 후 뒤로가기하면 확인창이 뜬다', async ({
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
  });

  test('이메일 중복 안내의 "Sign In"은 확인창 없이 바로 이동한다', async ({ page }) => {
    await mockEmailAvailability(page, false);
    await mockNicknameAvailability(page, true);

    await page.goto('/auth/sign-up');
    await page.getByPlaceholder(TEXTS.placeholders.nickname).fill('newuser');
    await page.getByPlaceholder(TEXTS.placeholders.email).fill('taken@example.com');

    // 하단 "Sign In" 링크는 페이지 로드 즉시부터 항상 존재해, 중복 안내 링크가 뜨기 전에
    // `.first()`만 걸면 (아직 1개뿐인) 하단 링크로 즉시 안정화돼버린다 - 두 링크가 모두
    // 마운트될 때까지 먼저 기다려야 `.first()`가 실제로 중복 안내 링크를 가리킨다(실측
    // 확인: 이 대기 없이는 디바운스 완료 전에 클릭이 하단 링크로 새서 이 테스트가 플레이키했다).
    const signInLinks = page.getByRole('link', { name: TEXTS.auth.signup.signIn });
    await expect(signInLinks).toHaveCount(2);

    // 이메일 필드 바로 아래에 먼저 렌더되는 쪽이 중복 안내 링크라 DOM 순서상 첫 번째다.
    const duplicateLoginLink = signInLinks.first();
    await duplicateLoginLink.click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('가입 요청이 실패한 뒤에도 "Sign In"을 누르면 확인창이 다시 뜬다', async ({ page }) => {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    await mockSignUpFailure(page);

    await page.goto('/auth/sign-up');
    await fillSignupForm(page);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();

    // 요청 실패 - 여전히 회원가입 페이지에 남아있어야 한다.
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    // useSignUp.ts의 onSubmit이 요청 직전에 clearNow()로 지웠던 키가, 실패로 isPending이
    // false로 돌아오면서(isDirty && !isPending) 다시 등록됐는지 확인한다.
    await footerLoginLink(page).click();
    await expect(guardDialog(page)).toBeVisible();
  });
});
