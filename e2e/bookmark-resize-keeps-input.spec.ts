import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts, mockBookmarkFolderRename } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import type { UpdateBookmarkFolderRequest } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';

// 폭 판정(useIsMobile)은 창 폭만 본다. 폰을 돌릴 때와 데스크톱 창 크기를 바꿀 때가 같은 경로라 창 폭으로 재현한다
const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 700, height: 800 };

const RENAME_DRAFT = '이름 바꾸는 중';
const SEARCH_DRAFT = '찾는 중';
const NEW_FOLDER_DRAFT = '새 폴더 쓰는 중';

function renameInput(page: Page) {
  return page.getByRole('textbox', { name: TEXTS.bookmark.folder.rename });
}

function searchInput(page: Page) {
  return page.getByPlaceholder(TEXTS.placeholders.bookmarkSearch);
}

function newFolderInput(page: Page) {
  return page.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder);
}

// 앱 사이드바도 complementary라 북마크 폴더 사이드바를 "미분류" 항목으로 가린다
function folderSidebar(page: Page) {
  return page.getByRole('complementary').filter({ hasText: TEXTS.bookmark.folder.uncategorized });
}

// 창 폭이 768px 경계를 넘어도 쓰던 입력이 남는다(docs/BOOKMARK.md §5 "폭이 바뀌어도 입력이 남는다")
test.describe('북마크 — 창 폭이 바뀌어도 쓰던 입력이 남는다', () => {
  let patchBodies: UpdateBookmarkFolderRequest[] = [];

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    patchBodies = await mockBookmarkFolderRename(page, [mockBookmarkFolder]);
  });

  test.describe('폴더를 고른 화면 — 두 폭 모두 글 화면이 보인다', () => {
    test('제목에서 바꾸던 이름이 좁혀도·다시 넓혀도 남고, 저장되지 않는다', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
      await page
        .locator('main header')
        .getByRole('button', { name: TEXTS.bookmark.folder.rename })
        .click();
      await renameInput(page).fill(RENAME_DRAFT);

      await page.setViewportSize(NARROW);
      await expect(renameInput(page)).toHaveValue(RENAME_DRAFT);

      await page.setViewportSize(WIDE);
      await expect(renameInput(page)).toHaveValue(RENAME_DRAFT);
      expect(patchBodies).toEqual([]);
    });

    test('좁은 화면 제목에서 바꾸던 이름이 넓혀도 남는다', async ({ page }) => {
      await page.setViewportSize(NARROW);
      await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
      await page.getByRole('button', { name: TEXTS.bookmark.folder.rename }).click();
      await renameInput(page).fill(RENAME_DRAFT);

      await page.setViewportSize(WIDE);
      await expect(renameInput(page)).toHaveValue(RENAME_DRAFT);
      expect(patchBodies).toEqual([]);
    });

    test('검색창에 쓰던(아직 검색하지 않은) 글이 좁혀도·다시 넓혀도 남는다', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);
      await searchInput(page).fill(SEARCH_DRAFT);

      await page.setViewportSize(NARROW);
      await expect(searchInput(page)).toHaveValue(SEARCH_DRAFT);

      await page.setViewportSize(WIDE);
      await expect(searchInput(page)).toHaveValue(SEARCH_DRAFT);
    });
  });

  test.describe('폴더를 고르지 않은 화면 — 좁으면 폴더 목록, 넓으면 사이드바와 글 화면', () => {
    test('사이드바 새 폴더 입력에 쓰던 이름이 좁혔다 넓히면 남아 있다', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto('/bookmark');
      await folderSidebar(page).getByRole('button', { name: TEXTS.bookmark.folder.create }).click();
      await newFolderInput(page).fill(NEW_FOLDER_DRAFT);

      await page.setViewportSize(NARROW);
      await expect(
        page.getByRole('heading', { name: TEXTS.bookmark.folder.pageTitle })
      ).toBeVisible();

      await page.setViewportSize(WIDE);
      await expect(folderSidebar(page).locator('input')).toHaveValue(NEW_FOLDER_DRAFT);
    });

    test('폴더 카드 목록의 새 폴더 입력에 쓰던 이름이 넓혔다 좁히면 남아 있다', async ({
      page,
    }) => {
      await page.setViewportSize(NARROW);
      await page.goto('/bookmark');
      await page.getByRole('button', { name: TEXTS.bookmark.folder.new }).click();
      await newFolderInput(page).fill(NEW_FOLDER_DRAFT);

      await page.setViewportSize(WIDE);
      await expect(folderSidebar(page)).toBeVisible();

      await page.setViewportSize(NARROW);
      await expect(newFolderInput(page)).toHaveValue(NEW_FOLDER_DRAFT);
    });

    // 숨으며 입력의 포커스가 빠져도 저장하지 않는다 - 포커스가 빠지면 저장하는 규칙대로면 보이지 않는 사이 이름이 바뀐다
    // (2026-11-19 사용자 선택: 숨긴 채 남기기)
    test('사이드바에서 바꾸던 이름이 좁혔다 넓히면 입력에 남고, 저장되지 않는다', async ({
      page,
    }) => {
      await page.setViewportSize(WIDE);
      await page.goto('/bookmark');
      await page.getByRole('button', { name: mockBookmarkFolder.name }).hover();
      await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
      await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();
      await folderSidebar(page).getByRole('textbox').fill(RENAME_DRAFT);

      await page.setViewportSize(NARROW);
      await expect(
        page.getByRole('heading', { name: TEXTS.bookmark.folder.pageTitle })
      ).toBeVisible();

      await page.setViewportSize(WIDE);
      await expect(folderSidebar(page).getByRole('textbox')).toHaveValue(RENAME_DRAFT);
      expect(patchBodies).toEqual([]);
    });

    test('폴더 카드에서 바꾸던 이름이 넓혔다 좁히면 입력에 남고, 저장되지 않는다', async ({
      page,
    }) => {
      await page.setViewportSize(NARROW);
      await page.goto('/bookmark');
      await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
      await page.getByRole('menuitem', { name: TEXTS.bookmark.folder.rename }).click();
      await page.getByRole('textbox').fill(RENAME_DRAFT);

      await page.setViewportSize(WIDE);
      await expect(folderSidebar(page)).toBeVisible();

      await page.setViewportSize(NARROW);
      await expect(page.getByRole('textbox')).toHaveValue(RENAME_DRAFT);
      expect(patchBodies).toEqual([]);
    });

    // 그대로 두면 메뉴를 연 버튼만 숨고 메뉴는 화면 왼쪽 위에 떠 남았다(2026-11-19 사용자 선택: 메뉴 닫기)
    test('사이드바 ⋮ 메뉴를 연 채 좁히면 메뉴가 닫힌다', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto('/bookmark');
      await page.getByRole('button', { name: mockBookmarkFolder.name }).hover();
      await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
      await expect(page.getByRole('menu')).toBeVisible();

      await page.setViewportSize(NARROW);
      await expect(
        page.getByRole('heading', { name: TEXTS.bookmark.folder.pageTitle })
      ).toBeVisible();
      await expect(page.getByRole('menu')).toHaveCount(0);
    });

    test('폴더 카드 ⋮ 메뉴를 연 채 넓히면 메뉴가 닫힌다', async ({ page }) => {
      await page.setViewportSize(NARROW);
      await page.goto('/bookmark');
      await page.getByRole('button', { name: TEXTS.ariaLabels.folderMenu }).click();
      await expect(page.getByRole('menu')).toBeVisible();

      await page.setViewportSize(WIDE);
      await expect(folderSidebar(page)).toBeVisible();
      await expect(page.getByRole('menu')).toHaveCount(0);
    });

    test('검색창에 쓰던 글이 좁혔다 넓히면 남아 있다', async ({ page }) => {
      await page.setViewportSize(WIDE);
      await page.goto('/bookmark');
      await searchInput(page).fill(SEARCH_DRAFT);

      await page.setViewportSize(NARROW);
      await expect(
        page.getByRole('heading', { name: TEXTS.bookmark.folder.pageTitle })
      ).toBeVisible();

      await page.setViewportSize(WIDE);
      await expect(searchInput(page)).toHaveValue(SEARCH_DRAFT);
    });
  });
});
