import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh, mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { TEXTS } from '@/shared/config/texts';

// 같은 브라우저 컨텍스트의 두 페이지는 localStorage를 공유하고 서로의 storage 이벤트를 받는다 -
// 실제 브라우저의 두 탭과 같다. 인증 세대(auth-epoch.util.ts)가 바뀌면 다른 탭이 useAuthEpochSync로
// 따라온다(docs/AUTH.md §8-H).

const VALID_PASSWORD = 'TestPass1!';

/** 페이지마다 route를 따로 건다(page.route는 페이지 단위) */
async function installMocks(page: Page) {
  await installCatchAll(page);
  await mockAuthRefresh(page);
  await mockLoginSuccess(page);
  await mockAccountQuery(page);
  await mockCategoryOptions(page);
  await mockPostList(page);
  await mockBookmarkFolderList(page);
  await mockBookmarkFolderPosts(page);
}

test.describe('탭 간 로그인·로그아웃 동기화', () => {
  test('한 탭에서 로그아웃하면 보호 페이지에 있던 다른 탭도 로그아웃되고 /post로 옮긴다', async ({
    context,
  }) => {
    // 두 탭 모두 이전 로그인 흔적이 있는 상태로 연다(auth.fixture.ts와 같은 시딩을 컨텍스트 전체에)
    await context.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);
    const bookmarkTab = await context.newPage();
    const feedTab = await context.newPage();
    await installMocks(bookmarkTab);
    await installMocks(feedTab);

    await bookmarkTab.goto('/bookmark');
    await expect(
      bookmarkTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })
    ).toBeVisible();
    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();

    await feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await feedTab.getByRole('menuitem', { name: TEXTS.nav.logOut }).click();
    await expect(feedTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    await expect(bookmarkTab).toHaveURL(/\/post$/);
    await expect(bookmarkTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();
  });

  test('한 탭에서 로그인하면 로그아웃 상태이던 다른 탭도 로그인된다', async ({ context }) => {
    const feedTab = await context.newPage();
    const loginTab = await context.newPage();
    await installMocks(feedTab);
    await installMocks(loginTab);

    await feedTab.goto('/post');
    await expect(feedTab.getByRole('button', { name: TEXTS.nav.logIn })).toBeVisible();

    await loginTab.goto('/auth/login');
    await loginTab.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await loginTab.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill(VALID_PASSWORD);
    await loginTab.getByRole('button', { name: TEXTS.auth.login.signIn }).click();
    await expect(loginTab).toHaveURL(/\/post$/);

    // 다른 탭은 쿠키로 세션을 받아들인다(여기서는 /auth/refresh 모킹)
    await expect(feedTab.getByRole('button', { name: TEXTS.ariaLabels.accountMenu })).toBeVisible();
  });
});
