import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged, mockPostDetail, pagedPostTitle } from './mocks/post.mock';
import { mockComments } from './mocks/comment.mock';
import { TEXTS } from '@/shared/config/texts';

// 드롭다운 메뉴(dropdown-menu.tsx)는 비모달이다 — 열린 동안에도 페이지가 스크롤되고,
// 스크롤하면 닫히며, 바깥 첫 클릭은 메뉴만 닫고 아래 요소로 전달되지 않는다.
// 계정 메뉴로 검증한다(래퍼 공통 동작이라 4개 메뉴 모두 같은 경로).
test.describe('드롭다운 메뉴 — 스크롤 허용·스크롤 시 닫힘·바깥 첫 클릭 흡수', () => {
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

  test('메뉴가 열려 있어도 휠로 스크롤되고, 스크롤하면 메뉴가 닫힌다', async ({ page }) => {
    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await expect(page.getByRole('menu')).toBeVisible();

    const bodyLock = await page.evaluate(() => ({
      overflow: getComputedStyle(document.body).overflow,
      scrollLocked: document.body.hasAttribute('data-scroll-locked'),
    }));
    expect(bodyLock).toEqual({ overflow: 'visible', scrollLocked: false });

    const viewport = page.viewportSize();

    if (!viewport) {
      throw new Error('viewport 크기를 읽지 못했다');
    }

    // 화면 가운데는 투명 오버레이 위다 — 오버레이 위 휠도 페이지로 전달돼야 한다.
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 600);

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('바깥 첫 클릭은 메뉴만 닫고, 다음 클릭은 정상 동작한다', async ({ page }) => {
    const card = page.getByRole('link', { name: pagedPostTitle(0) });

    // locator.click()는 누르기 전에 대상을 화면 안으로 자동 스크롤한다 — 그 스크롤이 메뉴를
    // 먼저 닫아버려 흡수 여부를 검증할 수 없으므로, 미리 잰 좌표를 스크롤 없이 누른다.
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();

    if (!box) {
      throw new Error('카드의 bounding box를 가져오지 못했다');
    }

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu }).click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.mouse.click(x, y);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page).toHaveURL(/\/post$/);

    await page.mouse.click(x, y);
    await expect(page).toHaveURL(new RegExp(`/post/.+`));
  });

  test('Esc로 닫으면 트리거로 포커스가 돌아간다', async ({ page }) => {
    const trigger = page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu });

    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
