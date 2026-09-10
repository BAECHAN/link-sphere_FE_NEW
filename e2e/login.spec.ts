import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockLoginSuccess, mockLoginFailure } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// zod passwordValidationSchema(auth.schema.ts:9-15) — 영문+숫자+특수문자 8자 이상,
// 20자 이하. 이 정규식을 통과해야 클라이언트 검증을 넘어 실제로 요청이 나간다.
const VALID_PASSWORD = 'TestPass1!';

test.describe('로그인 폼 제출', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
  });

  test('성공하면 /post로 이동하고 목록이 렌더된다', async ({ page }) => {
    // 로그인 성공 후 실제 화면 전환은 mutation이 아니라 GuestGuard가 담당한다
    // (auth.queries.ts:22-32에 navigate 없음, GuestGuard가 isAuthenticated를 보고
    // '/' → RootRedirect → '/post'로 리다이렉트, useLogin.ts § 조사 결과).
    await mockLoginSuccess(page);
    // 로그인 성공 직후 Navbar가 GET /auth/account를 자동 호출한다(놓치면 PR #67과
    // 같은 회귀 — 에러 토스트가 뜬다).
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);

    await page.goto('/auth/login');
    // getByLabel은 기본 부분 일치라 'Email'만 쓰면 'Save Email' 체크박스까지 걸린다
    // (strict mode violation, 실측 확인) — exact: true로 고정한다.
    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
  });

  test('비밀번호가 틀리면 일반화된 에러 메시지가 토스트로 뜨고 화면은 그대로다', async ({
    page,
  }) => {
    // code가 TOKEN_EXPIRED/NOT_LOGGED_IN/INVALID_TOKEN이 아니면 client.ts가 refresh
    // 시도나 강제 로그아웃 없이 그냥 throw한다 — useLoginMutation.onError(auth.queries.ts)가
    // 서버 원문 메시지는 노출하지 않고 loginFailedPasswordMismatch로 감싼다(error.util.ts의
    // "날것의 error.message를 노출하지 않는다" 정책). 서버가 실제로 어떤 문구를 보내든
    // 화면엔 항상 이 고정 메시지가 뜨는지 확인하려고, mock 메시지를 일부러 다른 문구로 둔다.
    await mockLoginFailure(page, '이메일 또는 비밀번호가 올바르지 않습니다.');

    await page.goto('/auth/login');
    // getByLabel은 기본 부분 일치라 'Email'만 쓰면 'Save Email' 체크박스까지 걸린다
    // (strict mode violation, 실측 확인) — exact: true로 고정한다.
    await page.getByLabel('Email', { exact: true }).fill('test@example.com');
    await page.getByLabel('Password', { exact: true }).fill(VALID_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText(TEXTS.messages.error.loginFailedPasswordMismatch)).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});
