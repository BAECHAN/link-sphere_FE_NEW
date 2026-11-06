import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockEmailAvailability, mockSignUpFailure } from './mocks/auth.mock';
import { mockNicknameAvailability } from './mocks/account.mock';
import { ENDPOINTS } from './mocks/endpoints';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// zod passwordValidationSchema(auth.schema.ts) — 영문+숫자+특수문자 8자 이상, 64자 이하.
const VALID_PASSWORD = 'TestPass1!';

// useUnsavedChangesGuard.ts — 회원가입(`/auth/sign-up`)은 GuestGuard 아래라 방문자가 항상
// 비로그인이다. useUnsavedChangesGuard.ts:18-20(isGuestOnlyPage)가 로그인·회원가입 페이지를
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

  // 가입 요청 중에 떠나려 하면 이미 요청했다는 문구로 확인창이 뜬다(usePendingSubmit)
  const PENDING_TEXTS = TEXTS.unsavedChanges.pending.signup;

  function pendingDialog(page: Page) {
    return page.getByRole('alertdialog', { name: PENDING_TEXTS.title });
  }

  /**
   * POST /auth/signup 응답을 테스트가 release()할 때까지 붙잡는다 - 시간 지연 대신 직접 풀어
   * "요청 중"이 응답보다 먼저 끝나는 흔들림을 없앤다. requested는 요청이 라우트에 닿으면 풀린다.
   */
  type SignUpOutcome = 'success' | 'failure' | 'duplicateEmail';

  async function holdSignUp(page: Page, outcome: SignUpOutcome) {
    let markRequested!: () => void;
    let release!: () => void;
    const requested = new Promise<void>((resolve) => {
      markRequested = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });

    await page.route(
      (url) => isApiPath(url, ENDPOINTS.auth.signup),
      async (route) => {
        markRequested();
        await released;

        if (outcome === 'success') {
          await route.fulfill({ json: wrapResponse(mockAccount) });
          return;
        }

        if (outcome === 'duplicateEmail') {
          await route.fulfill({
            status: 409,
            json: { status: 409, code: 'DUPLICATE_MEMBER', message: '이미 가입된 이메일이에요.' },
          });
          return;
        }

        await route.fulfill({
          status: 500,
          json: { status: 500, code: 'INTERNAL_ERROR', message: '서버 오류가 발생했어요.' },
        });
      }
    );

    return { requested, release };
  }

  async function submitAndHold(page: Page, outcome: SignUpOutcome = 'success') {
    await mockEmailAvailability(page, true);
    await mockNicknameAvailability(page, true);
    const signUp = await holdSignUp(page, outcome);

    await page.goto('/auth/sign-up');
    await fillSignupForm(page);
    await page.getByRole('button', { name: TEXTS.auth.signup.signUp }).click();
    await signUp.requested;
    await expect(page.getByRole('button', { name: TEXTS.auth.signup.signingUp })).toBeDisabled();

    return signUp;
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

    // 요청 실패가 반영될 때까지 기다린다 - URL은 클릭 직후에도 이미 sign-up이라 그것만 보면 실패
    // 전에 goBack이 먼저 실행될 수 있다(Playwright 1.64에서 5회 중 4회 실패). 토스트는 실패
    // 뒤에만 뜨고, 그 다음 버튼이 다시 눌러지면 isPending이 false로 돌아온 렌더다.
    await expect(page.getByText(TEXTS.messages.error.accountCreateFailed)).toBeVisible();
    await expect(page.getByRole('button', { name: TEXTS.auth.signup.signUp })).toBeEnabled();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    // useSignUp.ts의 onSubmit은 성공한 뒤에만 clearNow()로 키를 지운다 - 실패하면 요청 중에도
    // 유지되던 키(isDirty && !isSubmitted)가 그대로 남았는지 확인한다.
    await page.goBack();
    await expect(guardDialog(page)).toBeVisible();
  });

  test('가입 요청 중 Sign In 링크를 누르면 이미 요청했다는 확인창이 뜨고, "나가기" 뒤 가입이 끝나면 로그인 화면에 성공 토스트가 뜬다', async ({
    page,
  }) => {
    const signUp = await submitAndHold(page);

    await loginLink(page).click();
    await expect(pendingDialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/sign-up$/);

    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 위 테스트들과 같은 이유
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await pendingDialog(page).getByRole('button', { name: PENDING_TEXTS.confirm }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);

    signUp.release();

    await expect(page.getByText(TEXTS.messages.success.signUpCompleted)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('가입 요청 중 Sign In 링크로 뜬 확인창이 열린 채 가입이 끝나면 확인창이 닫히고 완료 화면이 보인다', async ({
    page,
  }) => {
    const signUp = await submitAndHold(page);

    await loginLink(page).click();
    await expect(pendingDialog(page)).toBeVisible();

    signUp.release();

    await expect(page.getByText(TEXTS.auth.signup.checkEmailTitle)).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    // 완료 화면이 결과를 보여주므로 토스트를 겹쳐 띄우지 않는다
    await expect(page.getByText(TEXTS.messages.success.signUpCompleted)).toHaveCount(0);
  });

  test('가입 요청 중 Sign In 링크로 뜬 확인창이 열린 채 가입이 실패하면 확인창이 닫히고 입력이 남는다', async ({
    page,
  }) => {
    const signUp = await submitAndHold(page, 'failure');

    await loginLink(page).click();
    await expect(pendingDialog(page)).toBeVisible();

    signUp.release();

    // 응답이 왔으니 "가입은 취소되지 않아요" 확인창의 전제가 사라졌다 - 닫고 이동도 취소한다
    await expect(page.getByText(TEXTS.messages.error.accountCreateFailed)).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('new@example.com');

    // 이제 입력만 남았으니 다시 떠나려 하면 평소 확인창이 뜬다
    await loginLink(page).click();
    await expect(guardDialog(page)).toBeVisible();
  });

  test('가입 요청 중 "나가기"로 떠난 뒤 가입이 실패하면 무엇이 실패했는지 알리고, [다시 가입하기]를 누르면 닉네임·이메일만 되살린다', async ({
    page,
  }) => {
    const signUp = await submitAndHold(page, 'failure');

    await loginLink(page).click();
    await expect(pendingDialog(page)).toBeVisible();
    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 위 테스트들과 같은 이유
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await pendingDialog(page).getByRole('button', { name: PENDING_TEXTS.confirm }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);

    signUp.release();

    // 원인을 특정하지 못한 실패(500)라 설명은 할 일만 적는다(useSignUp.ts showSignUpFailedAfterLeaving)
    const { leftPageFailure } = TEXTS.messages.error;
    await expect(page.getByText(leftPageFailure.signUpTitle)).toBeVisible();
    await expect(page.getByText(leftPageFailure.retryLater)).toBeVisible();

    await page.getByRole('button', { name: TEXTS.buttons.signUpAgain }).click();

    await expect(page).toHaveURL(/\/auth\/sign-up$/);
    await expect(page.getByPlaceholder(TEXTS.placeholders.nickname)).toHaveValue('newuser');
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('new@example.com');
    // 비밀번호는 브라우저 방문 기록(history.state)에 남지 않게 싣지 않는다
    await expect(page.getByPlaceholder(TEXTS.placeholders.password)).toHaveValue('');
    await expect(page.getByPlaceholder(TEXTS.placeholders.confirmPassword)).toHaveValue('');
    await expect(page.getByText(leftPageFailure.signUpTitle)).toHaveCount(0);

    // 되살린 입력도 작성 중이라 떠나려 하면 평소 확인창이 뜬다
    await loginLink(page).click();
    await expect(guardDialog(page)).toBeVisible();
  });

  test('Sign In 링크로 떠난 뒤 이메일 중복으로 실패하면, 이미 열린 로그인 화면에서 [로그인]을 눌러도 이메일 칸이 채워진다', async ({
    page,
  }) => {
    const signUp = await submitAndHold(page, 'duplicateEmail');

    await loginLink(page).click();
    await expect(pendingDialog(page)).toBeVisible();
    // alert-dialog.tsx의 열린 직후 클릭 가드(DOUBLE_CLICK_GUARD_MS) — 위 테스트들과 같은 이유
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await pendingDialog(page).getByRole('button', { name: PENDING_TEXTS.confirm }).click();
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('');

    signUp.release();

    await expect(page.getByText(TEXTS.auth.signup.emailDuplicate.split('. ')[0]!)).toBeVisible();
    // 로그인 화면의 제출 버튼도 "로그인"이라 토스트 안의 버튼으로 좁힌다
    await page
      .getByRole('region', { name: /Notifications/ })
      .getByRole('button', { name: TEXTS.buttons.login })
      .click();

    // 같은 화면이라 폼이 다시 마운트되지 않는다 - useLogin의 fillEmailArrivedOnSamePage가 채운다
    await expect(page.getByPlaceholder(TEXTS.placeholders.email)).toHaveValue('new@example.com');
  });
});
