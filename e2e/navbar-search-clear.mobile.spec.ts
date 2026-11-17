import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

/**
 * 모바일 검색 화면의 X는 입력만 비운다(MobileNavbarSearch.tsx). 이 화면의 열림은 히스토리 칸의 state에
 * 실려 있어, X가 URL의 q까지 빼면 그 칸이 바뀌며 화면이 닫혔다. jsdom에는 그 칸이 없어 단위 테스트는
 * "닫히지 않는다"를 증명하지 못해 실제 브라우저에서 확인한다(docs/SEARCH.md §10,
 * mobile-chrome 프로젝트 전용 — playwright.config.ts).
 */
test.describe('모바일 헤더 검색 — X 버튼', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('X를 누르면 검색 화면이 열린 채 입력만 비워지고, 닫으면 검색 결과가 그대로다', async ({
    page,
  }) => {
    await page.goto('/post?q=react');
    await expect(page.getByRole('link', { name: mockPost.title }).first()).toBeVisible();

    await page.getByRole('button', { name: TEXTS.nav.openSearch }).click();

    const input = page.locator('#mobile-search-input');
    await expect(input).toHaveValue('react');

    await page.getByRole('button', { name: TEXTS.ariaLabels.inputClear }).click();

    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();

    // X는 누른 뒤 포커스를 입력창으로 돌려주므로 곧바로 칠 수 있다
    await page.keyboard.type('vue');
    await expect(input).toHaveValue('vue');
    expect(new URL(page.url()).searchParams.get('q')).toBe('react');

    // 입력이 차 있으면 뒤로가기 버튼만 '닫기'다(트레일링 X는 '지우기')
    await page.getByRole('button', { name: TEXTS.ariaLabels.close }).click();

    await expect(input).toBeHidden();
    expect(new URL(page.url()).searchParams.get('q')).toBe('react');
  });
});
