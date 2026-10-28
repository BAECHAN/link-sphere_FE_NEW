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
import { TEXTS } from '@/shared/config/texts';

const SHORT_NAME = 'React';
// 14자 — 360px 폰의 2열 폴더 카드 이름 칸(108px)에 한 줄로는 안 들어간다
const LONG_NAME = '자바스크립트 심화 학습 자료';
// 15자 — 짧은 어절 뒤에 칸보다 긴 어절이 붙어 3줄이 된다
const THREE_LINE_NAME = 'JS 프론트엔드성능최적화자료';
const FOLDERS = [SHORT_NAME, LONG_NAME, THREE_LINE_NAME].map((name, i) => ({
  ...mockBookmarkFolder,
  id: `folder-${i}`,
  name,
  sortOrder: i,
}));

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

// 폴더 이름이 가장 좁게 보이는 자리는 360px 폰의 폴더 카드다(docs/BOOKMARK.md "폴더 이름 길이"·"폴더 이름 줄 수")
test.describe('모바일 — 북마크 폴더 이름 줄바꿈', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderPosts(page);
    await page.route(
      (url) => isApiPath(url, ENDPOINTS.bookmark.folders),
      (route) => route.fulfill({ json: wrapResponse({ folders: FOLDERS, uncategorizedCount: 0 }) })
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

  test('폴더 카드는 이름 줄 수와 상관없이 높이가 같고, 3줄이 되는 이름은 2줄에서 자른다', async ({
    page,
  }) => {
    await page.goto('/bookmark');

    const threeLineName = page.getByText(THREE_LINE_NAME, { exact: true });
    await expect(threeLineName).toBeVisible();
    expect(await visibleLineCount(threeLineName)).toBe(2);
    expect(await isFullyVisible(threeLineName)).toBe(false);

    // 폴더 카드는 이름 → 카드 버튼 → 테두리를 가진 카드 div 순이고, "새 폴더" 카드는 버튼에 테두리가 있다 —
    // 테두리까지 포함한 높이로 한 줄·두 줄·세 줄 이름 카드와 "새 폴더" 카드를 비교한다
    const cardHeights = await Promise.all(
      [SHORT_NAME, LONG_NAME, THREE_LINE_NAME].map((name) =>
        page
          .getByText(name, { exact: true })
          .locator('xpath=../..')
          .evaluate((el) => el.getBoundingClientRect().height)
      )
    );
    const createCardHeight = await page
      .getByRole('button', { name: TEXTS.bookmark.folder.new })
      .evaluate((el) => el.getBoundingClientRect().height);

    expect(new Set([...cardHeights, createCardHeight]).size).toBe(1);
  });
});
