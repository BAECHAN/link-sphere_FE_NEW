import type { Locator } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { isApiPath } from './mocks/route-match';
import { wrapResponse } from './mocks/wrap-response';
import { ENDPOINTS } from './mocks/endpoints';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { BOOKMARK_FOLDER_NAME_MAX_LENGTH } from '@/entities/bookmark/folder/config/bookmark-folder.const';
import { TEXTS } from '@/shared/config/texts';

// 14자 — 사이드바 이름 칸(126px)에 한 줄로는 안 들어가 예전에는 말줄임(…)으로 잘렸다
const LONG_NAME = '자바스크립트 심화 학습 자료';
const LONG_FOLDER = { ...mockBookmarkFolder, id: 'folder-long-name', name: LONG_NAME };
// 15자 — 짧은 어절 뒤에 칸보다 긴 어절이 붙어 사이드바에서 3줄이 된다
const THREE_LINE_NAME = 'JS 프론트엔드성능최적화자료';
const THREE_LINE_FOLDER = {
  ...mockBookmarkFolder,
  id: 'folder-three-line-name',
  name: THREE_LINE_NAME,
  sortOrder: 1,
};

// 폴더 이름은 줄바꿈하고 사이드바에서는 2줄에서 자른다(docs/BOOKMARK.md "폴더 이름 줄 수") — 글자가
// 가로·세로로 넘쳐 가려지지 않았는지 본다
async function isFullyVisible(locator: Locator): Promise<boolean> {
  return locator.evaluate(
    (el) =>
      getComputedStyle(el).textOverflow !== 'ellipsis' &&
      el.scrollWidth <= el.clientWidth &&
      el.scrollHeight <= el.clientHeight
  );
}

async function visibleLineCount(locator: Locator): Promise<number> {
  return locator.evaluate((el) =>
    Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight))
  );
}

test.describe('북마크 폴더 이름 — 줄바꿈 표시와 길이 제한', () => {
  let createRequestCount = 0;

  test.beforeEach(async ({ page }) => {
    createRequestCount = 0;
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) => {
        if (route.request().method() === 'POST') {
          createRequestCount += 1;
          return route.fulfill({ status: 201, json: wrapResponse({ id: 'created' }) });
        }

        return route.fulfill({
          json: wrapResponse({ folders: [LONG_FOLDER, THREE_LINE_FOLDER], uncategorizedCount: 0 }),
        });
      }
    );
  });

  test('긴 이름은 사이드바와 폴더 제목에서 잘리지 않는다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${LONG_FOLDER.id}`);

    const sidebarName = page.getByRole('complementary').getByText(LONG_NAME, { exact: true });
    await expect(sidebarName).toBeVisible();
    expect(await isFullyVisible(sidebarName)).toBe(true);

    const title = page.getByRole('heading', { level: 1, name: LONG_NAME });
    await expect(title).toBeVisible();
    expect(await isFullyVisible(title)).toBe(true);
  });

  test('3줄이 되는 이름은 사이드바에서 2줄로 자르고, 폴더 제목에서는 다 보여 준다', async ({
    page,
  }) => {
    await page.goto(`/bookmark?folder=${THREE_LINE_FOLDER.id}`);

    const sidebarName = page.getByRole('complementary').getByText(THREE_LINE_NAME, { exact: true });
    await expect(sidebarName).toBeVisible();
    expect(await visibleLineCount(sidebarName)).toBe(2);
    expect(await isFullyVisible(sidebarName)).toBe(false);

    const title = page.getByRole('heading', { level: 1, name: THREE_LINE_NAME });
    await expect(title).toBeVisible();
    expect(await isFullyVisible(title)).toBe(true);
  });

  test('상한을 넘기면 입력 아래에 이유를 보여 주고 생성을 막는다', async ({ page }) => {
    await page.goto('/bookmark');
    await page.getByRole('button', { name: TEXTS.bookmark.folder.create }).click();

    const input = page.getByPlaceholder(TEXTS.bookmark.folder.namePlaceholder);
    const submit = page.getByRole('button', {
      name: TEXTS.bookmark.folder.createSubmit,
      exact: true,
    });
    const overLength = BOOKMARK_FOLDER_NAME_MAX_LENGTH + 1;
    const reason = page.getByText(
      TEXTS.validation.folderNameTooLong(BOOKMARK_FOLDER_NAME_MAX_LENGTH, overLength)
    );

    await input.fill('가'.repeat(overLength));
    await expect(reason).toBeVisible();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(submit).toBeDisabled();

    // Enter도 막힌다
    await input.press('Enter');
    await expect(reason).toBeVisible();

    await input.fill('가'.repeat(BOOKMARK_FOLDER_NAME_MAX_LENGTH));
    await expect(reason).toHaveCount(0);
    await expect(submit).toBeEnabled();
    expect(createRequestCount).toBe(0);
  });
});
