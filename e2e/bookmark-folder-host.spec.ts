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

// 폴더 선택 창은 카드 밖(RootLayout 호스트)에 있다 — 북마크 페이지에서 폴더를 빼 카드가 목록에서 빠져도 창은
// 닫힘 애니메이션을 끝까지 하고, 실패하면 열린 채 남는다(docs/BOOKMARK.md §5). 데스크톱은 히스토리 경로다.
// 모바일(히스토리 없는 경로)은 bookmark-folder-host.mobile.spec.ts가 같은 장면을 본다.
test.describe('북마크 페이지 — 카드가 목록에서 빠져도 폴더 창은 카드와 함께 사라지지 않는다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
  });

  test('폴더에서 빼기가 성공하면 창이 닫힘 상태를 거쳐 사라진다', async ({ page }) => {
    await mockRemoveFromFolderScene(page, { fail: false });
    const dialog = await openSheetOnFolderPage(page);
    const readLog = await recordDialogLifecycle(page);

    await dialog.getByRole('button', { name: removeSceneFolder.name }).click();

    // 응답 전 — 카드는 이미 빠졌고 창은 열려 있다(카드 안에 있던 때는 여기서 창도 함께 사라졌다)
    await expect(cardTitle(page)).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await expect(dialog).toHaveCount(0);
    expect(await readLog()).toEqual(['closed', 'removed']);
  });

  test('폴더에서 빼기가 실패하면 창이 다시 마운트되지 않고 열린 채 에러를 알린다', async ({
    page,
  }) => {
    await mockRemoveFromFolderScene(page, { fail: true });
    const dialog = await openSheetOnFolderPage(page);
    const readLog = await recordDialogLifecycle(page);

    await dialog.getByRole('button', { name: removeSceneFolder.name }).click();
    await expect(cardTitle(page)).toHaveCount(0);

    await expect(page.getByText(TEXTS.messages.error.bookmarkRemoveFromFolderFailed)).toBeVisible();
    // 롤백 재조회로 카드가 돌아온 뒤에도 창은 처음 연 그 노드 그대로다
    await expect(cardTitle(page)).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await readLog()).toEqual([]);
  });
});
