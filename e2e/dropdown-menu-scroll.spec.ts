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
    // 스크롤 닫기는 이동 거리 임계값(dropdown-menu.tsx의 SCROLL_CLOSE_THRESHOLD_PX)을 쓴다 —
    // 첫 스크롤 이벤트는 기준선으로만 기록되고(우발적인 미세 스크롤·직전 관성 스크롤을
    // 흡수하기 위해서다), 두 번째 이벤트부터 기준선과의 차이를 비교한다. 실제 휠 스크롤도
    // 한 번에 끝나지 않고 여러 tick으로 이어지므로 wheel을 두 번 보낸다.
    await page.mouse.wheel(0, 600);
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

  // 2026-09-24 회귀 4건 — 북마크 폴더 ⋮ 메뉴가 가끔 열렸다가 바로 닫힌다는 제보를 재현해
  // 확정한 원인 2개(docs/DECISIONS.md 2026-09-24 "스크롤 닫기에 이동 거리 임계값 + 연속
  // 클릭 무시" 참고).
  test('1px 미만의 우발적인 스크롤로는 닫히지 않는다', async ({ page }) => {
    const trigger = page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu });

    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();

    await page.mouse.move(200, 200);
    await page.mouse.wheel(0, 1);

    await page.waitForTimeout(300);
    await expect(page.getByRole('menu')).toBeVisible();
  });

  test('클릭 직전에 시작된 스크롤의 관성이 열고 난 뒤 도착해도 닫히지 않는다', async ({ page }) => {
    const trigger = page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu });

    // 클릭 전에 미리 스크롤을 걸어 두고 곧바로 트리거를 클릭한다 — 그 스크롤의 이벤트가
    // 메뉴가 열린 뒤에 도착하는 상황을 재현한다.
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 300);
    await trigger.click({ force: true });

    await page.waitForTimeout(300);
    await expect(page.getByRole('menu')).toBeVisible();
  });

  test('더블클릭(또는 마우스 채터링)의 두 번째 클릭으로는 닫히지 않지만, 그 뒤 별개의 단일 클릭으로는 닫힌다', async ({
    page,
  }) => {
    const trigger = page.getByRole('button', { name: TEXTS.ariaLabels.accountMenu });
    const box = await trigger.boundingBox();

    if (!box) {
      throw new Error('트리거의 bounding box를 가져오지 못했다');
    }

    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.dblclick(x, y);
    await page.waitForTimeout(300);
    await expect(page.getByRole('menu')).toBeVisible();

    // OS 더블클릭 판정 창을 벗어난 뒤의 별개의 단일 클릭은 오버레이를 그대로 닫는다.
    await page.waitForTimeout(600);
    await page.mouse.click(x, y);
    await expect(page.getByRole('menu')).toHaveCount(0);
  });
});
