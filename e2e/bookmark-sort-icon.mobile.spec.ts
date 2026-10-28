import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { TEXTS } from '@/shared/config/texts';

const { latest, title } = TEXTS.bookmark.folder.sort;

// 모바일 정렬은 제목과 같은 줄에 두려고 ↕ 아이콘만 둔다. 기본(최신 북마크순)이 아니면 점을 찍고,
// 지금 정렬은 이름(aria-label)으로 알린다(docs/BOOKMARK.md §5 "모바일 정렬 아이콘")
test.describe('모바일 — 폴더 화면 정렬 아이콘', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('기본 정렬이면 점이 없고, 제목순을 고르면 URL·이름이 바뀌고 점이 생긴다', async ({
    page,
  }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}`);

    const trigger = page.getByRole('combobox', {
      name: TEXTS.ariaLabels.bookmarkSortSelectCurrent(latest),
    });
    await expect(trigger).toBeVisible();
    // 점은 aria-hidden span이다 — ↕ 아이콘은 svg라 이 선택자에 걸리지 않는다
    const dot = trigger.locator('span[aria-hidden="true"]');
    await expect(dot).toHaveCount(0);

    await trigger.click();
    await page.getByRole('option', { name: title }).click();

    await expect(page).toHaveURL(/sort=title/);
    const titleTrigger = page.getByRole('combobox', {
      name: TEXTS.ariaLabels.bookmarkSortSelectCurrent(title),
    });
    await expect(titleTrigger).toBeVisible();
    await expect(titleTrigger.locator('span[aria-hidden="true"]')).toHaveCount(1);
  });

  test('열린 목록에서 지금 정렬에 체크가 붙는다', async ({ page }) => {
    await page.goto(`/bookmark?folder=${mockBookmarkFolder.id}&sort=title`);
    await page
      .getByRole('combobox', { name: TEXTS.ariaLabels.bookmarkSortSelectCurrent(title) })
      .click();

    const selected = page.getByRole('option', { name: title });
    await expect(selected).toHaveAttribute('aria-selected', 'true');
    await expect(selected.locator('svg')).toBeVisible();
    await expect(page.getByRole('option', { name: latest }).locator('svg')).toHaveCount(0);
  });
});
