import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';

// Sidebar.tsx의 모바일 드로어 백드롭(fixed inset-0)도 RecentSearchPanel과 같은 이유로
// 배경 스크롤 잠금이 없었다. RemoveScroll로 감싸 막은 것을 실제 브라우저에서 검증한다
// (mobile-chrome 프로젝트 전용).
test.describe('모바일 — 사이드바 드로어가 열린 동안 배경 스크롤 잠금', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('드로어를 열면 배경 스크롤이 잠기고, 배경을 탭해 닫으면 풀린다', async ({ page }) => {
    await page.goto('/post');

    await page.getByRole('button', { name: TEXTS.nav.toggleMenu }).click();

    const backdrop = page.locator('div.fixed.inset-0.z-scrim');
    await expect(backdrop).toBeVisible();

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe('hidden');

    // 드로어 패널(w-64=256px)은 화면 왼쪽에 있다 — 그보다 오른쪽(x=350)을 탭해
    // 백드롭 자체를 클릭한다(실사용자가 배경을 탭해 드로어를 닫는 것과 동일).
    await backdrop.click({ position: { x: 350, y: 100 } });

    await expect(backdrop).toBeHidden();

    const bodyOverflowAfterClose = await page.evaluate(
      () => getComputedStyle(document.body).overflow
    );
    expect(bodyOverflowAfterClose).not.toBe('hidden');
  });
});
