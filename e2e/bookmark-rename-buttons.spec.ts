import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts, mockBookmarkFolderRename } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.contract';
import type { UpdateBookmarkFolderRequest } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';

const NEW_NAME = '프론트엔드 자료';

// 사이드바 ⋮ → 이름 수정. 입력이 열린 사이드바만 고른다(앱 사이드바도 complementary다)
async function openSidebarRename(page: Page) {
  await page.goto('/bookmark');
  await page.getByRole('button', { name: mockBookmarkFolder.name }).hover();
  await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
  await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();

  const sidebar = page.getByRole('complementary').filter({ has: page.getByRole('textbox') });
  const input = sidebar.getByRole('textbox');
  await expect(input).toBeFocused();

  return { sidebar, input };
}

async function openTitleRename(page: Page) {
  await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
  const header = page.locator('main header');
  await header.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();

  const input = header.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
  await expect(input).toBeFocused();

  return { header, input };
}

// 이름 바꾸기 입력의 취소·저장 버튼(docs/BOOKMARK.md §5 "이름 바꾸기 취소·저장 버튼"). 취소는 누르는 순간
// 입력에서 포커스가 빠지면 blur 저장이 먼저 나가므로, 요청이 0건인지까지 본다
test.describe('북마크 폴더 이름 바꾸기 — 취소·저장 버튼', () => {
  let patchBodies: UpdateBookmarkFolderRequest[] = [];

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    patchBodies = await mockBookmarkFolderRename(page, [mockBookmarkFolder]);
  });

  test('사이드바 취소는 원래 이름으로 돌아가고 저장 요청을 보내지 않는다', async ({ page }) => {
    const { sidebar, input } = await openSidebarRename(page);
    await input.fill(NEW_NAME);

    await sidebar.getByRole('button', { name: TEXTS.buttons.cancel }).click();

    await expect(input).toBeHidden();
    await expect(page.getByRole('button', { name: mockBookmarkFolder.name })).toBeVisible();
    expect(patchBodies).toEqual([]);
  });

  test('사이드바 저장은 바꾼 이름을 저장한다', async ({ page }) => {
    const { sidebar, input } = await openSidebarRename(page);
    await input.fill(NEW_NAME);

    await sidebar
      .getByRole('button', { name: TEXTS.bookmark.folder.renameSubmit, exact: true })
      .click();

    await expect(input).toBeHidden();
    await expect(page.getByRole('button', { name: NEW_NAME })).toBeVisible();
    expect(patchBodies).toEqual([{ name: NEW_NAME }]);
  });

  test('폴더 화면 제목의 취소는 원래 제목으로 돌아가고 저장 요청을 보내지 않는다', async ({
    page,
  }) => {
    const { header, input } = await openTitleRename(page);
    await input.fill(NEW_NAME);

    await header.getByRole('button', { name: TEXTS.buttons.cancel }).click();

    await expect(input).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
    ).toBeVisible();
    expect(patchBodies).toEqual([]);
  });

  test('폴더 화면 제목의 저장은 바꾼 이름을 저장한다', async ({ page }) => {
    const { header, input } = await openTitleRename(page);
    await input.fill(NEW_NAME);

    await header
      .getByRole('button', { name: TEXTS.bookmark.folder.renameSubmit, exact: true })
      .click();

    await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
    expect(patchBodies).toEqual([{ name: NEW_NAME }]);
  });

  test('이름이 비었거나 최대 길이를 넘으면 저장 버튼이 꺼지고, 넘었을 때는 이유를 보여 준다', async ({
    page,
  }) => {
    const { header, input } = await openTitleRename(page);
    const save = header.getByRole('button', {
      name: TEXTS.bookmark.folder.renameSubmit,
      exact: true,
    });

    await input.fill('');
    await expect(save).toBeDisabled();

    const tooLong = '가'.repeat(BOOKMARK_FOLDER_NAME_MAX_LENGTH + 1);
    await input.fill(tooLong);
    await expect(save).toBeDisabled();
    await expect(
      header.getByText(
        TEXTS.validation.folderNameTooLong(BOOKMARK_FOLDER_NAME_MAX_LENGTH, tooLong.length)
      )
    ).toBeVisible();

    await input.fill(NEW_NAME);
    await expect(save).toBeEnabled();
    expect(patchBodies).toEqual([]);
  });
});
