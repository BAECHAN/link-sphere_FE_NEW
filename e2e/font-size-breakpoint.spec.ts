import { test, expect } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';

// 미디어 쿼리의 rem은 페이지가 아니라 브라우저 기본 글꼴 크기를 따른다. 기본 글꼴이 20px이면
// Tailwind md(48rem)는 960px이라 폭 800px은 CSS로는 모바일 배치인데, JS·CSS가 경계를 px(768px)로
// 판정하던 때는 여기서 데스크톱으로 봐 둘이 갈렸다(responsive-ux skill "브레이크포인트").
// 기본 글꼴 크기는 CDP(Page.setFontSizes)로만 바꿀 수 있어 Chromium 프로젝트에서만 돈다.
test.use({ viewport: { width: 800, height: 900 } });

test.describe('브라우저 기본 글꼴을 키운 사용자 — 폭 판정이 CSS 배치를 따른다', () => {
  test.beforeEach(async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.enable');
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 20 } });

    await installCatchAll(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('모바일 배치에서 검색을 열면 본문을 잠그고, 토스트 자리는 탭바 위로 잡힌다', async ({
    page,
  }) => {
    await page.goto('/post');

    await page.getByRole('button', { name: TEXTS.nav.toggleSearch }).click();
    await expect(page.getByText(TEXTS.recentSearch.empty)).toBeVisible();

    // inert인 main은 접근성 트리에서 빠져 getByRole로 찾을 수 없다
    await expect(page.locator('main')).toHaveJSProperty('inert', true);

    // 데스크톱 값(globals.css :root 기본값 24px)이 아니라 max-md 쪽 값이어야 한다. Chromium은
    // env()를 계산해 돌려줘서(calc(4rem + 0px + 0.75rem)) 모바일 값 문자열과 직접 비교하지 않는다
    const toastOffset = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--toast-offset-bottom')
    );
    expect(toastOffset.trim()).not.toBe('24px');
  });
});
