import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';

// RecentSearchPanel은 fixed + overflow-y-auto로 배경(main)을 덮는데, overscroll-behavior
// 방지 장치가 없어 목록 끝까지 스크롤 후 계속 스와이프하면 배경으로 스크롤이 체이닝될 수
// 있었다. RemoveScroll(react-remove-scroll)로 감싸 막은 것을 실제 브라우저에서 검증한다
// (jsdom은 CSS 반영 여부를 증명 못 한다 — mobile-chrome 프로젝트 전용).
test.describe('모바일 — 검색 오버레이가 열린 동안 배경 스크롤 잠금', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('검색을 열면 배경 스크롤이 잠기고, 닫으면 풀린다', async ({ page }) => {
    await page.goto('/post');

    const searchToggle = page.getByRole('button', { name: TEXTS.nav.toggleSearch });
    await expect(searchToggle).toBeVisible();
    await searchToggle.click();

    await expect(page.getByText(TEXTS.recentSearch.empty)).toBeVisible();

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyOverflow).toBe('hidden');

    // 뒤로가기(back 버튼)로 검색을 닫는다 — 입력이 비어 있어 back/trailing X 둘 다
    // aria-label이 '닫기'로 같아지므로(post-detail-search-overlay.mobile.spec.ts와 동일한
    // 이유) 첫 번째(뒤로가기 버튼)를 클릭한다.
    await page.getByRole('button', { name: TEXTS.ariaLabels.close }).first().click();

    await expect(page.getByText(TEXTS.recentSearch.empty)).toBeHidden();

    const bodyOverflowAfterClose = await page.evaluate(
      () => getComputedStyle(document.body).overflow
    );
    expect(bodyOverflowAfterClose).not.toBe('hidden');
  });
});
