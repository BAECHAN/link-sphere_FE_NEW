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

// 14자 — 360px 폰의 2열 폴더 카드 이름 칸(108px)에 한 줄로는 안 들어간다
const LONG_NAME = '자바스크립트 심화 학습 자료';
const LONG_FOLDER = { ...mockBookmarkFolder, id: 'folder-long-name', name: LONG_NAME };

async function isFullyVisible(locator: Locator): Promise<boolean> {
  return locator.evaluate(
    (el) => getComputedStyle(el).textOverflow !== 'ellipsis' && el.scrollWidth <= el.clientWidth
  );
}

// 폴더 이름이 가장 좁게 보이는 자리는 360px 폰의 폴더 카드다(docs/BOOKMARK.md "폴더 이름 길이")
test.describe('모바일 — 북마크 폴더 이름 줄바꿈', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) =>
        route.fulfill({ json: wrapResponse({ folders: [LONG_FOLDER], uncategorizedCount: 0 }) })
    );
  });

  test('360px 폰의 폴더 카드와 폴더 제목에서 긴 이름이 잘리지 않는다', async ({ page }) => {
    await page.goto('/bookmark');

    const cardName = page.getByText(LONG_NAME, { exact: true });
    await expect(cardName).toBeVisible();
    expect(await isFullyVisible(cardName)).toBe(true);

    await cardName.click();

    const title = page.getByRole('heading', { level: 1, name: LONG_NAME });
    await expect(title).toBeVisible();
    expect(await isFullyVisible(title)).toBe(true);
  });
});
