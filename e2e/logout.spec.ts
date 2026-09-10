import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

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
    // AuthUtil.clearAll이 /post로 replace 이동시킨다(auth.util.ts:64-68).
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);

    await page.goto('/bookmark');
    await expect(page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await page.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();

    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
  });
});
