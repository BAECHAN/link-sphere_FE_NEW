import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged, mockPostDetail, pagedPostTitle } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { TEXTS } from '@/shared/config/texts';

// dropdown-menu-scroll.spec.ts의 모바일(터치) 판. 터치 드래그는 Playwright 고수준 API가
// 없어 CDP Input.synthesizeScrollGesture로 실제 스크롤 제스처를 합성한다. 위로 끌어올리는
// 방향(yDistance 음수)이라 usePullToRefresh(맨 위에서 아래로 당길 때만 동작)를 깨우지 않는다.
test.describe('모바일 — 드롭다운 메뉴 스크롤 허용·스크롤 시 닫힘·바깥 첫 탭 흡수', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostListPaged(page, { total: 40 });
    await mockPostDetail(page);
    await mockComments(page, []);

    await page.goto('/post');
    await expect(page.getByRole('link', { name: pagedPostTitle(0) })).toBeVisible();
  });

  test('메뉴가 열려 있어도 터치 드래그로 스크롤되고, 스크롤하면 메뉴가 닫힌다', async ({
    page,
  }) => {
    const viewport = page.viewportSize();

    if (!viewport) {
      throw new Error('viewport 크기를 읽지 못했다');
    }

    const cdp = await page.context().newCDPSession(page);
    const swipeUp = () =>
      cdp.send('Input.synthesizeScrollGesture', {
        x: Math.round(viewport.width / 2),
        y: Math.round(viewport.height * 0.7),
        yDistance: -400,
        gestureSourceType: 'touch',
      });

    // 기준선: 메뉴 없이도 합성 터치 제스처가 스크롤을 일으키는지 먼저 본다. CI(Linux headless)
    // 에서는 이 제스처가 메뉴와 무관하게 scrollY를 0으로 남겼다 — 그런 환경에서 실패시키면
    // 앱 문제와 환경 문제를 구분할 수 없으므로 건너뛴다(로컬 macOS Chromium에서는 동작).
    await swipeUp();
    const baselineScrolled = await page
      .waitForFunction(() => window.scrollY > 0, null, { timeout: 3_000 })
      .then(
        () => true,
        () => false
      );
    test.skip(!baselineScrolled, '이 환경에서는 합성 터치 스크롤 제스처가 스크롤을 일으키지 않음');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).tap();
    await expect(page.getByRole('menu')).toBeVisible();

    await swipeUp();

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('바깥 첫 탭은 메뉴만 닫고, 다음 탭은 정상 동작한다', async ({ page }) => {
    const card = page.getByRole('link', { name: pagedPostTitle(0) });

    // locator.tap()는 누르기 전에 대상을 화면 안으로 자동 스크롤한다 — 그 스크롤이 메뉴를
    // 먼저 닫아버려 흡수 여부를 검증할 수 없으므로, 미리 잰 좌표를 스크롤 없이 누른다.
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();

    if (!box) {
      throw new Error('카드의 bounding box를 가져오지 못했다');
    }

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).tap();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.touchscreen.tap(x, y);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page).toHaveURL(/\/post$/);

    await page.touchscreen.tap(x, y);
    await expect(page).toHaveURL(new RegExp(`/post/.+`));
  });
});
