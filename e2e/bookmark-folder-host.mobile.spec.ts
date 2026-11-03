import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import {
  mockRemoveFromFolderScene,
  openSheetOnFolderPage,
  recordDialogLifecycle,
  removeSceneFolder,
  cardTitle,
} from './mocks/bookmark-folder-remove-scene';
import { TEXTS } from '@/shared/config/texts';

// bookmark-folder-host.spec.ts와 같은 장면을 Pixel 5(히스토리 없이 열리는 경로, CloseWatcher)에서 본다.
// 이 경로는 열림이 스토어에 있어, 카드 안에 창이 있던 때는 실패 뒤 돌아온 카드가 창을 새로 마운트했다.
test.describe('모바일 북마크 페이지 — 카드가 목록에서 빠져도 폴더 시트는 카드와 함께 사라지지 않는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
  });

  test('폴더에서 빼기가 성공하면 시트가 닫힘 상태를 거쳐 사라진다', async ({ page }) => {
    await mockRemoveFromFolderScene(page, { fail: false });
    const dialog = await openSheetOnFolderPage(page);
    const readLog = await recordDialogLifecycle(page);

    await dialog.getByRole('button', { name: removeSceneFolder.name }).click();

    await expect(cardTitle(page)).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await expect(dialog).toHaveCount(0);
    expect(await readLog()).toEqual(['closed', 'removed']);
  });

  test('폴더에서 빼기가 실패하면 시트가 다시 마운트되지 않고 열린 채 에러를 알린다', async ({
    page,
  }) => {
    await mockRemoveFromFolderScene(page, { fail: true });
    const dialog = await openSheetOnFolderPage(page);
    const readLog = await recordDialogLifecycle(page);

    await dialog.getByRole('button', { name: removeSceneFolder.name }).click();
    await expect(cardTitle(page)).toHaveCount(0);

    await expect(page.getByText(TEXTS.messages.error.bookmarkRemoveFromFolderFailed)).toBeVisible();
    await expect(cardTitle(page)).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await readLog()).toEqual([]);
  });
});
