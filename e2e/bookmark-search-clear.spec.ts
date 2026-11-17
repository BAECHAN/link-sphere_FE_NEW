import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

/**
 * 북마크 내 검색에서 입력을 다 지우면 URL의 q가 바로 빠진다(useBookmarkSearch.handleInputChange).
 * 그 URL 반영이 늦게 도착하면 "URL이 바뀌면 입력창을 URL 값으로 맞춘다"는 동기화가 그 사이 친 글자를
 * 빈 값으로 덮었다. jsdom은 이동이 즉시 반영돼 단위 테스트로는 재현되지 않아 실제 브라우저에서
 * CPU를 늦춰 확인한다(docs/BOOKMARK.md §10).
 */
test.describe('북마크 내 검색 — 다 지운 직후 입력', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
  });

  test('검색어를 다 지우고 바로 친 글자가 입력창에 남고 URL의 q는 빠진다', async ({ page }) => {
    await page.goto('/bookmark?q=react');
    await expect(page.getByRole('link', { name: mockPost.title }).first()).toBeVisible();

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    const input = page.getByPlaceholder(TEXTS.placeholders.bookmarkSearch);
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(5, 5));

    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Backspace');
    }

    await page.keyboard.type('vue');

    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
    // URL 반영이 끝난 뒤에도 친 글자가 그대로여야 한다
    await page.waitForTimeout(500);
    await expect(input).toHaveValue('vue');
  });

  test('X 버튼을 누르고 바로 친 글자가 입력창에 남고 URL의 q는 빠진다', async ({ page }) => {
    await page.goto('/bookmark?q=react');
    await expect(page.getByRole('link', { name: mockPost.title }).first()).toBeVisible();

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    const input = page.getByPlaceholder(TEXTS.placeholders.bookmarkSearch);
    // X는 누른 뒤 포커스를 입력창으로 돌려주므로 곧바로 칠 수 있다
    await page.getByRole('button', { name: TEXTS.ariaLabels.inputClear }).click();
    await page.keyboard.type('vue');

    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
    // URL 반영이 끝난 뒤에도 친 글자가 그대로여야 한다
    await page.waitForTimeout(500);
    await expect(input).toHaveValue('vue');
  });
});
