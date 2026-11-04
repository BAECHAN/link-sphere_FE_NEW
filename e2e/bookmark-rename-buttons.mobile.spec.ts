import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts, mockBookmarkFolderRename } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { UpdateBookmarkFolderRequest } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';

const NEW_NAME = '프론트엔드 자료';

async function openCardRename(page: Page) {
  await page.goto('/bookmark');
  await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
  await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();

  const input = page.getByRole('textbox');
  await expect(input).toHaveValue(mockBookmarkFolder.name);

  return input;
}

async function openTitleRename(page: Page) {
  await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
  await page.getByRole('button', { name: TEXTS.bookmark.folder.rename }).tap();

  const input = page.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
  await expect(input).toBeFocused();

  return input;
}

// 모바일 북마크 페이지(BookmarkPage.tsx 모바일 분기)의 취소·저장 버튼은 손가락으로 누른다 — tap()으로 터치 이벤트부터
// 보내, 터치에서도 취소의 포커스 이동 막기(onMouseDown preventDefault)가 blur 저장을 막는지 본다(docs/BOOKMARK.md §5
// "이름 바꾸기 취소·저장 버튼"). iOS Safari 실기기는 따로 확인한다
test.describe('모바일 — 북마크 폴더 이름 바꾸기 취소·저장 버튼', () => {
  let patchBodies: UpdateBookmarkFolderRequest[] = [];

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    patchBodies = await mockBookmarkFolderRename(page, [mockBookmarkFolder]);
  });

  test('폴더 카드의 취소를 누르면 원래 이름으로 돌아가고 저장 요청을 보내지 않는다', async ({
    page,
  }) => {
    const input = await openCardRename(page);
    await input.fill(NEW_NAME);

    await page.getByRole('button', { name: TEXTS.buttons.cancel }).tap();

    await expect(input).toBeHidden();
    await expect(page.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();
    expect(patchBodies).toEqual([]);
  });

  test('폴더 카드의 저장을 누르면 바꾼 이름을 저장한다', async ({ page }) => {
    const input = await openCardRename(page);
    await input.fill(NEW_NAME);

    await page.getByRole('button', { name: TEXTS.bookmark.folder.renameSubmit, exact: true }).tap();

    await expect(input).toBeHidden();
    await expect(page.getByRole('button', { name: NEW_NAME })).toBeVisible();
    expect(patchBodies).toEqual([{ name: NEW_NAME }]);
  });

  test('폴더 화면 제목의 ✕를 누르면 원래 제목으로 돌아가고 저장 요청을 보내지 않는다', async ({
    page,
  }) => {
    const input = await openTitleRename(page);
    await input.fill(NEW_NAME);

    await page.getByRole('button', { name: TEXTS.buttons.cancel }).tap();

    await expect(input).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
    ).toBeVisible();
    expect(patchBodies).toEqual([]);
  });

  test('폴더 화면 제목의 ✓를 누르면 바꾼 이름을 저장한다', async ({ page }) => {
    const input = await openTitleRename(page);
    await input.fill(NEW_NAME);

    await page.getByRole('button', { name: TEXTS.bookmark.folder.renameSubmit, exact: true }).tap();

    await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
    expect(patchBodies).toEqual([{ name: NEW_NAME }]);
  });

  test('폴더 화면 제목을 바꾸는 동안 ←·정렬(↕)이 숨고, 끝나면 돌아온다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const back = page.getByRole('button', { name: TEXTS.ariaLabels.backToFolderList });
    const sort = page.locator('main header').getByRole('combobox');
    await expect(back).toBeVisible();
    await expect(sort).toBeVisible();

    await page.getByRole('button', { name: TEXTS.bookmark.folder.rename }).tap();
    const input = page.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await expect(input).toBeVisible();
    // 같은 줄의 44px ✕ ✓에 자리를 내줘 입력 칸이 좁아지지 않게 한다(2026-11-04 사용자 선택,
    // docs/BOOKMARK.md §5 "터치 기기 버튼 44px")
    await expect(back).toBeHidden();
    await expect(sort).toBeHidden();

    await page.getByRole('button', { name: TEXTS.buttons.cancel }).tap();

    await expect(input).toBeHidden();
    await expect(back).toBeVisible();
    await expect(sort).toBeVisible();
  });
});
