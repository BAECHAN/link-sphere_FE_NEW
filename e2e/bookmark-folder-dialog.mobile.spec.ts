import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList, mockPostDetail, mockPostListPaged } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// Pixel 5 에뮬레이션에서 북마크 폴더 창과 뒤로가기. 창은 모든 기기에서 같은 주소의 히스토리 칸으로 열린다
// (useBackClosableOverlay) - 열기·뒤로가기·화면에서 닫기의 공통 검사는 back-closable-overlay.mobile.spec.ts가
// 맡고, 여기는 이 창에만 있는 장면을 본다. 데스크톱은 bookmark-folder-dialog.spec.ts가 다룬다.
test.describe('모바일(터치) — 북마크 폴더 창과 뒤로가기', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockBookmarkFolderList(page);
  });

  test('상세 화면에서 창을 연 채 뒤로가기를 누르면 창만 닫히고, 한 번 더 누르면 목록으로 간다', async ({
    page,
  }) => {
    // 2026-11-10 Android에서 보고된 장면 - 뒤로가기 한 번에 창을 건너뛰고 목록으로 갔다
    await mockPostList(page);
    await mockPostDetail(page);
    await mockComments(page, []);
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
    await page.goto(`/post/${mockPost.id}`);
    await expect(page.getByRole('heading', { name: mockPost.title })).toBeVisible();

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.goBack();
    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/post/${mockPost.id}$`));

    await page.goBack();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('가로로 돌려 열 수가 바뀌고 카드가 다시 마운트돼도 폴더 창은 열린 채로 남는다', async ({
    page,
  }) => {
    // 행 키가 `${열 수}:${첫 카드 id}`라(useWindowGridVirtualizer.ts) 열 수가 바뀌면 카드가 다시 마운트된다.
    // 열림이 카드 안이 아니라 히스토리 칸에 있고 창은 RootLayout의 호스트가 그려서 유지된다
    await mockPostListPaged(page, { total: 6 });
    await page.goto('/post');
    const grid = page.locator('[style*="grid-template-columns"]').first();
    await expect(grid).toHaveAttribute('style', /repeat\(1,/);

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.setViewportSize({ width: 851, height: 393 });
    await expect(grid).toHaveAttribute('style', /repeat\(2,/);
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.ariaLabels.close }).click();
    await expect(folderDialog).not.toBeVisible();
  });

  test('새 폴더 입력 중 ESC는 입력만 접고, 한 번 더 누르면 창이 닫힌다', async ({ page }) => {
    await mockPostList(page);
    await page.goto('/post');

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
    await folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder).fill('읽을거리');
    await page.keyboard.press('Escape');

    await expect(folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder)).toBeHidden();
    await expect(
      folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create })
    ).toBeVisible();
    await expect(folderDialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('새 폴더 이름을 쓰다 뒤로가기를 누르면 창이 닫히고 페이지는 그대로다', async ({ page }) => {
    // 입력만 접던 동작은 CloseWatcher 위에서만 됐다 - 히스토리 칸으로 다시 만들면 칸이 겹쳐 쌓여 없앴다
    // (docs/BACK-NAVIGATION.md). 데스크톱·iOS가 원래 이렇게 동작했다
    await mockPostList(page);
    await page.goto('/post');

    await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
    const folderDialog = page.getByRole('dialog');
    await expect(folderDialog).toBeVisible();

    await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
    await folderDialog.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
    await folderDialog.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder).fill('읽을거리');

    await page.goBack();

    await expect(folderDialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/post$/);
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();
  });
});
