import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';

// PostCard의 hover 들림 효과(globals.css의 hover-or-open, PostCard.tsx)는 Card 자신의
// :hover뿐 아니라 그 안의 ⋮ 드롭다운이 열려 있는 동안에도 유지돼야 한다. DropdownMenuContent가
// Portal로 <body>에 렌더되므로(dropdown-menu.tsx) 커서가 메뉴로 들어가면 Card는 더 이상
// :hover 상태가 아니게 된다 — hover-or-open이 없으면 이때 들림이 풀린다.
test.describe('PostCard hover 유지 — 드롭다운이 열려 있는 동안', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    // isOwner(⋮ 메뉴 렌더)에 필수.
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
  });

  test('⋮ 메뉴를 열고 커서를 메뉴 항목으로 옮겨도 카드가 들린 채로 유지된다', async ({ page }) => {
    await page.goto('/post');
    await expect(page.getByRole('link', { name: mockPost.title })).toBeVisible();

    const menuButton = page.getByRole('button', { name: TEXTS.ariaLabels.postMenu });
    // Card 루트는 별도 role/data-slot이 없어, ⋮ 트리거에서부터 overflow-hidden 클래스를 가진
    // 가장 가까운 조상 div로 찾는다 — PostCard.tsx의 Card 루트만 이 조합을 가진다
    // (헤더·소유자 액션 div는 overflow-hidden이 없다).
    const card = menuButton.locator('xpath=ancestor::div[contains(@class, "overflow-hidden")][1]');

    // Tailwind v4의 translate-y 유틸은 transform이 아니라 별도 translate 프로퍼티를 쓴다
    // (getComputedStyle(...).transform은 translate/rotate/scale과 무관하게 항상 transform
    // 프로퍼티 자체의 값만 돌려주므로 "none"으로 고정 — translate로 직접 확인한다).
    await card.hover();
    await expect(card).toHaveCSS('translate', '0px -2px');

    await menuButton.click();
    const menuItem = page.getByRole('menuitem', { name: TEXTS.post.card.edit });
    await expect(menuItem).toBeVisible();
    await menuItem.hover();

    // 커서가 카드 DOM 밖(Portal)에 있어도 hover-or-open이 aria-expanded=true를 보고
    // 들림을 유지해야 한다.
    await expect(card).toHaveCSS('translate', '0px -2px');

    // 메뉴를 닫고 카드 밖으로 커서를 옮기면 원상 복귀한다.
    await page.keyboard.press('Escape');
    await expect(menuItem).toBeHidden();
    await page.mouse.move(0, 0);
    await expect(card).toHaveCSS('translate', 'none');
  });
});
