import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged, pagedPostTitle } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';

// URL이 바뀌면 맨 위로 가는 전역 규칙(<ScrollRestoration/>)에서 빠져야 하는 이동은
// preventScrollReset으로 명시한다. 모바일 검색 패널 열기는 같은 URL에 state만 싣는 PUSH라
// 배경 피드를 그대로 둬야 한다 — useMobileSearchPanel.openMobileSearch의 preventScrollReset이
// 빠지면 패널을 여는 순간 배경이 맨 위로 튀어 이 테스트가 실패한다.
test.describe('모바일 — 검색 패널을 열어도 배경 피드 위치는 그대로', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostListPaged(page, { total: 30 });
  });

  test('피드 중간에서 검색 패널을 열면 배경 스크롤이 유지된다', async ({ page }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: pagedPostTitle(0) })).toBeVisible();
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, 1500));
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    }).toPass();
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.getByRole('button', { name: TEXTS.nav.toggleSearch }).click();
    await expect(page.getByText(TEXTS.recentSearch.empty)).toBeVisible();

    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });
});
