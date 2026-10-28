import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts, mockBookmarkFolderRename } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.const';
import type { UpdateBookmarkFolderRequest } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';

const NEW_NAME = '프론트엔드 자료';

// 폴더 화면 제목 옆 연필로 사이드바·카드와 같은 방식으로 이름을 바꾼다(docs/BOOKMARK.md §5 "폴더 화면에서 이름 바꾸기")
test.describe('북마크 폴더 화면 — 제목에서 이름 바꾸기', () => {
  let patchBodies: UpdateBookmarkFolderRequest[] = [];

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    patchBodies = await mockBookmarkFolderRename(page, [mockBookmarkFolder]);
  });

  test('연필을 누르면 지금 이름이 든 입력이 열리고, Enter로 저장하면 제목과 사이드바가 함께 바뀐다', async ({
    page,
  }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const header = page.locator('main header');
    await header.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();

    const input = header.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(mockBookmarkFolder.name);

    await input.fill(NEW_NAME);
    await input.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: NEW_NAME })).toBeVisible();
    await expect(
      page.getByRole('complementary').getByText(NEW_NAME, { exact: true })
    ).toBeVisible();
    expect(patchBodies).toEqual([{ name: NEW_NAME }]);
  });

  test('편집 입력은 제목과 같은 글자 크기다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const header = page.locator('main header');
    const titleFontSize = await header
      .getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
      .evaluate((el) => getComputedStyle(el).fontSize);

    await header.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();

    // tailwind-merge가 제목 역할 토큰을 글자 크기로 못 알아봐 Input 기본 크기(md:text-sm)가 이겼던 회귀를 막는다
    const inputFontSize = await header
      .getByRole('textbox', { name: TEXTS.bookmark.folder.rename })
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(inputFontSize).toBe(titleFontSize);
  });

  test('Escape를 누르면 저장하지 않고 원래 제목으로 돌아간다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const header = page.locator('main header');
    await header.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();

    const input = header.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await input.fill(NEW_NAME);
    await input.press('Escape');

    await expect(input).toBeHidden();
    await expect(
      page.getByRole('heading', { level: 1, name: mockBookmarkFolder.name })
    ).toBeVisible();
    expect(patchBodies).toEqual([]);
  });

  test('최대 길이를 넘기면 입력 아래 이유를 보여 주고 입력을 닫지 않는다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
    const header = page.locator('main header');
    await header.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();

    const tooLong = '가'.repeat(BOOKMARK_FOLDER_NAME_MAX_LENGTH + 1);
    const input = header.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
    await input.fill(tooLong);
    await input.press('Enter');

    await expect(
      header.getByText(
        TEXTS.validation.folderNameTooLong(BOOKMARK_FOLDER_NAME_MAX_LENGTH, tooLong.length)
      )
    ).toBeVisible();
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(patchBodies).toEqual([]);
  });

  test('전체·미분류 화면 제목에는 연필이 없다', async ({ page }) => {
    for (const [key, title] of [
      ['all', TEXTS.bookmark.folder.all],
      ['uncategorized', TEXTS.bookmark.folder.uncategorized],
    ] as const) {
      await page.goto(`/bookmark?folder=${key}`);
      const header = page.locator('main header');
      await expect(header.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(header.getByRole('button', { name: TEXTS.bookmark.folder.rename })).toHaveCount(
        0
      );
    }
  });
});
