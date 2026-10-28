import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostDetail, mockPostList } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import type { Page } from '@playwright/test';

test.describe('로그아웃', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('비보호 페이지(/post)에서 로그아웃하면 URL은 그대로다', async ({ page }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();

    // handleLogout이 700ms 지연 후 실제 로그아웃을 수행한다(Navbar.tsx:52-57) —
    // 그동안 이 스피너 버튼이 아바타 자리를 대신한다.
    await expect(page.getByText(TEXTS.nav.loggingOut)).toBeVisible();

    await expect(page.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('보호 페이지(/bookmark)에서 로그아웃하면 /post로 이동한다', async ({ page }) => {
    // isProtectedPath(route-paths.ts:28-35)가 /bookmark 접두사를 보호 경로로 판별해
    // AuthUtil.clearAll이 /post로 replace 이동시킨다(auth.util.ts:99-103).
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);

    await page.goto('/bookmark');
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();

    // 요청을 계속 기록해두되, AuthUtil.clearAll()이 실제로 실행되는 시점(=/auth/logout
    // 요청 시점)을 기준으로 그 이후만 검사한다 - handleLogout이 "로그아웃 처리 중" 표시를
    // 700ms 보여준 뒤에야 실제 로그아웃을 수행하므로(Navbar.tsx:50-57), 클릭 직후 요청은
    // 아직 clearAll() 호출 전에 일어난 페이지의 정상 동작(폴더 프리페치 등)일 수 있다.
    const requests: { atMs: number; url: string }[] = [];
    const t0 = Date.now();
    page.on('request', (r) => requests.push({ atMs: Date.now() - t0, url: r.url() }));
    const logoutRequest = page.waitForRequest((r) => r.url().includes('/auth/logout'));

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();
    await logoutRequest;
    const clearAllAtMs = Date.now() - t0;

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    // 이 변경의 핵심 가치: /bookmark는 화면이 곧 /post로 교체될 예정이므로, clearAll()
    // 이후로는 그 화면의 쿼리를 배경 재요청하지 않아야 한다(clearQueriesWithoutRefetch,
    // auth.util.ts:82-93).
    const bookmarkRequestsAfterClearAll = requests.filter(
      (r) => r.atMs >= clearAllAtMs && r.url.includes('/bookmark/folders')
    );
    expect(bookmarkRequestsAfterClearAll).toHaveLength(0);
  });
});

// 쓰는 중에 직접 로그아웃하면 그 글을 버리게 되므로 먼저 묻는다(useDelayedLogout,
// docs/plans/2026-10-28-keep-writing-in-place.md 결정 7)
test.describe('쓰는 중에 로그아웃', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  async function clickLogout(page: Page) {
    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();
  }

  /** 확인창은 열린 직후 클릭을 무시한다(useOpenClickGuard) - 가드 시간을 흘려보낸 뒤 누른다 */
  async function answerLogoutConfirm(page: Page, name: string) {
    const confirm = page.getByRole('alertdialog', { name: TEXTS.unsavedChanges.logout.title });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(TEXTS.unsavedChanges.logout.message)).toBeVisible();
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await confirm.getByRole('button', { name }).click();
    await expect(confirm).toBeHidden();
  }

  test('댓글을 쓰는 중이면 먼저 묻고, 계속 작성을 고르면 그대로 두며, 로그아웃을 고르면 쓰던 댓글을 버리고 피드로 간다', async ({
    page,
  }) => {
    await mockPostDetail(page);
    await mockComments(page, []);

    await page.goto(`/post/${mockPost.id}`);
    const commentInput = page.getByPlaceholder(TEXTS.comment.form.commentPlaceholder);
    await commentInput.fill('로그아웃 전에 쓰던 댓글');

    await clickLogout(page);
    await answerLogoutConfirm(page, TEXTS.unsavedChanges.logout.cancel);

    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
    await expect(commentInput).toHaveValue('로그아웃 전에 쓰던 댓글');

    await clickLogout(page);
    await answerLogoutConfirm(page, TEXTS.unsavedChanges.logout.confirm);

    await expect(page.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
    // 버리기로 했으니 이탈 확인창이 다시 묻지 않는다
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('글 등록 화면(보호 화면)에서 쓰는 중에 로그아웃을 고르면 이탈 확인 없이 /post로 간다', async ({
    page,
  }) => {
    await page.goto('/post/submit');
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다
    await page.getByLabel(/^URL/).fill('https://newlink.example.com/article');

    await clickLogout(page);
    await answerLogoutConfirm(page, TEXTS.unsavedChanges.logout.confirm);

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});
