import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';

// 태블릿을 세로로 들면(갤럭시 탭 S6 Lite 세로 약 800px) 폭은 md 이상이라 데스크톱 배치가 되지만
// 입력은 터치다. 키보드 단축키 힌트는 폭이 아니라 주 입력(pointer: coarse)으로 숨긴다
// (responsive-ux skill "브레이크포인트"). 모바일 UA·터치는 프로젝트(Pixel 5) 그대로 두고 폭만 바꾼다.
test.use({ viewport: { width: 800, height: 1280 } });

test.describe('태블릿 세로 폭 — 터치 기기의 키보드 단축키 힌트', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('데스크톱 검색창은 보이지만 "/" 힌트는 숨기고, "/" 단축키는 그대로 동작한다', async ({
    page,
  }) => {
    await page.goto('/post');

    // 이 스펙의 전제 - 에뮬레이션이 터치를 주 입력으로 보고해야 아래 단언이 의미가 있다
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);

    const searchInput = page.locator('#header-search-input');
    await expect(searchInput).toBeVisible();
    await expect(page.locator('form:has(#header-search-input) kbd')).toBeHidden();

    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();
  });
});
