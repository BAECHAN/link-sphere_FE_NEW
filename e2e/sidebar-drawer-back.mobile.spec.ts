import { test as guestTest, type Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh, mockLoginSuccess } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostListPaged, pagedPostTitle } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// 메뉴 열림은 히스토리 엔트리(useBackClosableOverlay)라, 메뉴 링크가 그 엔트리를 남기면 뒤로 왔을 때 메뉴가
// 다시 열린다(docs/plans/2026-11-07-sidebar-back-reopen.md). 히스토리 스택은 실제 브라우저에서만 끝까지 볼 수 있다.
const TOTAL_POSTS = 40;
const TARGET_POST_INDEX = 15;
const POSITION_TOLERANCE_PX = 50;

function getDrawer(page: Page) {
  return page.locator('aside.z-drawer');
}

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: TEXTS.nav.openMenu }).click();
  await expect(getDrawer(page)).toBeVisible();
}

function getDrawerLink(page: Page, name: string) {
  return getDrawer(page).getByRole('link', { name });
}

// 뒤로가기는 주소가 화면보다 먼저 바뀐다. 메뉴가 열리기 전 순간을 보고 통과하지 않도록 돌아온 칸에 메뉴 열림이 없는지 같이 본다
// (피드가 무거우면 toBeHidden이 커밋 전에 통과해, 고치기 전 코드에서도 초록이었다)
async function expectDrawerClosedAfterBack(page: Page) {
  const isDrawerEntry = await page.evaluate(() => Boolean(window.history.state?.usr?.sidebarOpen));

  expect(isDrawerEntry).toBe(false);
  await expect(getDrawer(page)).toBeHidden();
}

function getLoginDialog(page: Page) {
  return page.getByRole('dialog', { name: TEXTS.auth.guard.title });
}

// page.touchscreen 스와이프는 usePullToRefresh를 깨워 쓰지 않는다(post-list-scroll-restore.mobile.spec.ts와 같은 방식)
async function scrollToTargetCard(page: Page) {
  const target = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });

  await expect
    .poll(
      async () => {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        return target.count();
      },
      { timeout: 30_000, intervals: [300] }
    )
    .toBeGreaterThan(0);

  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();

  const box = await target.boundingBox();

  if (!box) {
    throw new Error('대상 카드의 위치를 읽지 못했다');
  }

  return box;
}

async function expectTargetCardAt(page: Page, y: number) {
  const target = page.getByRole('link', { name: pagedPostTitle(TARGET_POST_INDEX) });

  await expect
    .poll(async () => {
      const box = await target.boundingBox();
      return box ? Math.abs(box.y - y) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThan(POSITION_TOLERANCE_PX);
}

test.describe('모바일 메뉴 — 로그인 상태에서 이동한 뒤 뒤로가기', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('메뉴에서 북마크로 간 뒤 뒤로 오면 메뉴가 닫혀 있고 스크롤이 그대로다', async ({ page }) => {
    test.setTimeout(60_000);
    await mockPostListPaged(page, { total: TOTAL_POSTS });
    await page.goto('/post');

    const { y } = await scrollToTargetCard(page);

    await openDrawer(page);
    await getDrawerLink(page, TEXTS.nav.bookmark).click();
    await expect(page).toHaveURL(/\/bookmark$/);
    await expect(getDrawer(page)).toBeHidden();

    await page.goBack();

    await expect(page).toHaveURL(/\/post$/);
    await expectDrawerClosedAfterBack(page);
    await expectTargetCardAt(page, y);
  });

  test('메뉴를 연 채 뒤로가기를 누르면 메뉴만 닫힌다', async ({ page }) => {
    await mockPostList(page);
    await page.goto('/post');
    await openDrawer(page);

    await page.goBack();

    await expect(getDrawer(page)).toBeHidden();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('메뉴에서 지금 화면을 누르면 메뉴만 닫히고 스크롤이 그대로다', async ({ page }) => {
    test.setTimeout(60_000);
    await mockPostListPaged(page, { total: TOTAL_POSTS });
    await page.goto('/post');

    const { y } = await scrollToTargetCard(page);

    await openDrawer(page);
    await getDrawerLink(page, TEXTS.nav.feed).click();

    await expect(getDrawer(page)).toBeHidden();
    await expect(page).toHaveURL(/\/post$/);
    await expectTargetCardAt(page, y);
  });

  test('메뉴에서 지금 화면을 누른 뒤 뒤로가기 한 번이면 이전 화면으로 간다', async ({ page }) => {
    await mockPostList(page);
    await page.goto('/bookmark');
    await page.locator('nav.fixed.bottom-0').getByRole('link', { name: TEXTS.nav.feed }).click();
    await expect(page).toHaveURL(/\/post$/);

    await openDrawer(page);
    await getDrawerLink(page, TEXTS.nav.feed).click();
    await expect(getDrawer(page)).toBeHidden();

    await page.goBack();

    await expect(page).toHaveURL(/\/bookmark$/);
    await expectDrawerClosedAfterBack(page);
  });

  test('메뉴의 로고로 이동한 뒤 뒤로 오면 메뉴가 닫혀 있다', async ({ page }) => {
    await mockPostList(page);
    await page.goto('/bookmark');
    await openDrawer(page);

    await getDrawerLink(page, TEXTS.nav.brand).click();
    await expect(page).toHaveURL(/\/post$/);

    await page.goBack();

    await expect(page).toHaveURL(/\/bookmark$/);
    await expectDrawerClosedAfterBack(page);
  });

  test('작성 중 이탈 확인창을 거쳐 이동한 뒤 뒤로 오면 메뉴가 닫혀 있다', async ({ page }) => {
    await mockPostList(page);
    await page.goto('/post/submit');
    await page.getByLabel(/^URL/).fill('https://example.com/typed');
    await openDrawer(page);

    await getDrawerLink(page, TEXTS.nav.bookmark).click();

    const guardDialog = page.getByRole('alertdialog', { name: TEXTS.unsavedChanges.title });

    await expect(guardDialog).toBeVisible();
    // alert-dialog.tsx의 열린 직후 클릭 가드 - 클릭 자체를 삼켜 관측 가능한 이벤트로 대체할 수 없다
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await guardDialog.getByRole('button', { name: TEXTS.unsavedChanges.confirm }).click();
    await expect(page).toHaveURL(/\/bookmark$/);
    // 주소는 화면보다 먼저 바뀐다. 폼이 언마운트되기 전에 뒤로 가면 가드가 그 이동을 다시 막는다
    await expect(page.getByLabel(/^URL/)).toHaveCount(0);

    await page.goBack();

    await expect(page).toHaveURL(/\/post\/submit$/);
    await expectDrawerClosedAfterBack(page);
  });
});

// has-session 플래그가 있으면 로그인 상태가 되어 가드를 못 타므로 auth.fixture를 쓰지 않는다(protected-nav.spec.ts와 같은 이유)
guestTest.describe('모바일 메뉴 — 비로그인으로 보호된 메뉴를 눌렀을 때', () => {
  guestTest.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await mockLoginSuccess(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
    await page.goto('/post');
    await openDrawer(page);
    await getDrawerLink(page, TEXTS.nav.bookmark).click();
    await expect(getLoginDialog(page)).toBeVisible();
    await expect(getDrawer(page)).toBeHidden();
  });

  guestTest('로그인 창을 취소하면 메뉴가 다시 열리지 않는다', async ({ page }) => {
    await page.keyboard.press('Escape');

    await expect(getLoginDialog(page)).toBeHidden();
    await expect(getDrawer(page)).toBeHidden();
    await expect(page).toHaveURL(/\/post$/);
  });

  guestTest('로그인한 뒤 뒤로 오면 메뉴도 로그인 창도 다시 뜨지 않는다', async ({ page }) => {
    const dialog = getLoginDialog(page);

    // 필수 표시(*)까지 포함해야 '이메일 저장' 체크박스와 겹치지 않는다(protected-nav.spec.ts와 같은 방식)
    await dialog.getByLabel(`${TEXTS.labels.email}*`, { exact: true }).fill('test@example.com');
    await dialog.getByLabel(`${TEXTS.labels.password}*`, { exact: true }).fill('TestPass1!');
    // dialog.tsx의 열린 직후 클릭 가드 - 위 fill 두 번이 400ms를 채운다는 보장이 없다
    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await dialog.getByRole('button', { name: TEXTS.auth.login.signIn }).click();
    await expect(page).toHaveURL(/\/bookmark$/);

    await page.goBack();

    await expect(page).toHaveURL(/\/post$/);
    await expectDrawerClosedAfterBack(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
