import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList, mockBookmarkFolderPosts } from './mocks/bookmark-folder.mock';
import { TEXTS } from '@/shared/config/texts';

// 닫힌 모바일 메뉴는 화면 밖으로 밀기만 해서 안 보이는 링크와 X가 키보드 이동·읽기 순서에 남았고,
// 열어도 포커스가 뒤쪽 햄버거에 머물렀다(docs/plans/2026-11-06-a11y-button-names.md). jsdom에는 CSS가
// 없어 실제 숨김·트랜지션은 브라우저에서만 확인할 수 있다.
const DRAWER_SELECTOR = 'aside.z-drawer';
const DRAWER_WIDTH = 256;
const TAB_PRESSES = 12;

function getDrawer(page: Page) {
  return page.locator(DRAWER_SELECTOR);
}

function getDrawerClose(page: Page) {
  return getDrawer(page).getByRole('button', { name: TEXTS.ariaLabels.close });
}

function getHamburger(page: Page) {
  return page.getByRole('button', { name: TEXTS.nav.openMenu });
}

// 트랜지션을 멈춰 세운 지점의 실제 계산값을 읽는다(bookmark-sheet-motion.mobile.spec.ts와 같은 방식).
// 메뉴 전체가 움직이므로 위치는 문자열 대신 화면에 그려진 왼쪽 끝으로 본다.
function sampleTransitionMidway(page: Page, trigger: 'close' | 'open') {
  return page.evaluate(
    async ({ selector, trigger, hamburgerLabel }) => {
      const drawer = document.querySelector<HTMLElement>(selector);
      const button =
        trigger === 'close'
          ? drawer?.querySelector('button')
          : Array.from(document.querySelectorAll('nav button')).find((candidate) =>
              candidate.textContent?.includes(hamburgerLabel)
            );

      if (!drawer || !(button instanceof HTMLElement)) {
        throw new Error('drawer button not found');
      }

      const expectedClass = trigger === 'close' ? '-translate-x-full' : 'translate-x-0';

      button.click();
      await new Promise<void>((resolve) => {
        const check = () => {
          if (drawer.classList.contains(expectedClass)) {
            resolve();
            return;
          }

          requestAnimationFrame(check);
        };
        check();
      });

      const transitions = drawer
        .getAnimations()
        .filter((animation): animation is CSSTransition => animation instanceof CSSTransition);

      transitions.forEach((transition) => {
        transition.pause();
        transition.currentTime = 100;
      });

      const closeButton = drawer.querySelector('button');
      const closeButtonProperties = (closeButton?.getAnimations() ?? [])
        .filter((animation): animation is CSSTransition => animation instanceof CSSTransition)
        .map((transition) => transition.transitionProperty);

      return {
        properties: transitions.map((transition) => transition.transitionProperty).sort(),
        closeButtonProperties,
        visibility: getComputedStyle(drawer).visibility,
        left: drawer.getBoundingClientRect().left,
      };
    },
    { selector: DRAWER_SELECTOR, trigger, hamburgerLabel: TEXTS.nav.openMenu }
  );
}

test.describe('모바일 메뉴 — 숨김과 포커스', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await page.goto('/post');
    await expect(getHamburger(page)).toBeVisible();
  });

  test('닫힌 메뉴의 링크와 X는 숨겨지고 Tab으로 들어갈 수 없다', async ({ page }) => {
    await expect(getDrawer(page)).toBeHidden();
    await expect(getDrawer(page).getByRole('link')).toHaveCount(0);
    await expect(getDrawer(page).getByRole('button')).toHaveCount(0);

    for (let press = 0; press < TAB_PRESSES; press += 1) {
      await page.keyboard.press('Tab');

      const isInDrawer = await page.evaluate(
        (selector) => document.activeElement?.closest(selector) !== null,
        DRAWER_SELECTOR
      );

      expect(isInDrawer).toBe(false);
    }
  });

  test('터치로 열면 X로 포커스가 가고 포커스 링은 그리지 않는다', async ({ page }) => {
    await getHamburger(page).tap();

    await expect(getDrawerClose(page)).toBeFocused();

    const showsFocusRing = await getDrawerClose(page).evaluate((button) =>
      button.matches(':focus-visible')
    );

    expect(showsFocusRing).toBe(false);
  });

  test('키보드로 열면 X에 포커스 링이 보인다', async ({ page }) => {
    await getHamburger(page).focus();
    await page.keyboard.press('Enter');

    await expect(getDrawerClose(page)).toBeFocused();

    const showsFocusRing = await getDrawerClose(page).evaluate((button) =>
      button.matches(':focus-visible')
    );

    expect(showsFocusRing).toBe(true);
  });

  test('Esc로 닫으면 메뉴가 숨겨지고 포커스가 햄버거로 돌아온다', async ({ page }) => {
    await getHamburger(page).click();
    await expect(getDrawerClose(page)).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(getDrawer(page)).toBeHidden();
    await expect(getHamburger(page)).toBeFocused();
    await expect(page).toHaveURL(/\/post$/);
  });

  test('X로 닫아도 포커스가 햄버거로 돌아온다', async ({ page }) => {
    await getHamburger(page).click();
    await getDrawerClose(page).click();

    await expect(getDrawer(page)).toBeHidden();
    await expect(getHamburger(page)).toBeFocused();
  });

  test('메뉴가 닫혀 있을 때 Esc는 페이지를 떠나지 않는다', async ({ page }) => {
    await page.keyboard.press('Escape');

    await expect(page).toHaveURL(/\/post$/);
    await expect(getHamburger(page)).toBeVisible();
  });

  test('메뉴에서 등록으로 이동하면 URL 칸의 포커스를 뺏지 않는다', async ({ page }) => {
    // 같은 레이아웃(ProtectedLayout) 안에서 움직여야 햄버거가 다시 마운트되지 않아 되돌릴 곳이 남고, 코드를 이미
    // 받은 화면이라야 URL 칸의 autoFocus가 메뉴가 닫히는 커밋에 함께 일어난다 - 그래서 등록에서 북마크로 갔다 돌아온다.
    await mockBookmarkFolderList(page);
    await mockBookmarkFolderPosts(page);
    await page.goto('/post/submit');
    await expect(page.getByLabel(/^URL/)).toBeFocused();

    await getHamburger(page).click();
    await getDrawer(page).getByRole('link', { name: TEXTS.nav.bookmark }).click();
    await expect(page).toHaveURL(/\/bookmark$/);
    await expect(getDrawer(page)).toBeHidden();

    await getHamburger(page).click();
    await getDrawer(page).getByRole('link', { name: TEXTS.nav.submit }).click();

    await expect(page).toHaveURL(/\/post\/submit$/);
    // URL 필드는 필수 표시(*)가 붙어 접근 가능한 이름이 "URL*"가 된다 - 앞부분만 고정해서 매칭한다.
    await expect(page.getByLabel(/^URL/)).toBeFocused();
    await expect(getDrawer(page)).toBeHidden();
  });

  test('닫는 동안에는 보인 채로 밀려나고, 끝나면 숨겨진다', async ({ page }) => {
    await getHamburger(page).click();
    await expect(getDrawerClose(page)).toBeFocused();
    // 열림 트랜지션이 끝나 왼쪽 끝이 0에 닿은 뒤에 닫아야 닫힘 구간만 잴 수 있다
    await expect
      .poll(() => getDrawer(page).evaluate((drawer) => drawer.getBoundingClientRect().left))
      .toBe(0);

    const sample = await sampleTransitionMidway(page, 'close');

    expect(sample.properties).toEqual(['translate', 'visibility']);
    expect(sample.visibility).toBe('visible');
    expect(sample.left).toBeGreaterThan(-DRAWER_WIDTH);
    expect(sample.left).toBeLessThan(0);
  });

  test('여는 동안 움직임은 그대로이고 처음부터 보인다', async ({ page }) => {
    const sample = await sampleTransitionMidway(page, 'open');

    expect(sample.properties).toEqual(['translate']);
    // X가 부모의 visibility를 자기 트랜지션으로 받으면 진행률 0에서 hidden이라 focus()가 실패한다
    expect(sample.closeButtonProperties).not.toContain('visibility');
    expect(sample.visibility).toBe('visible');
    expect(sample.left).toBeGreaterThan(-DRAWER_WIDTH);
    expect(sample.left).toBeLessThan(0);
  });

  test('동작 줄이기에서는 움직임 없이 바로 숨겨진다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await getHamburger(page).click();
    await expect(getDrawerClose(page)).toBeFocused();

    const sample = await sampleTransitionMidway(page, 'close');

    expect(sample.properties).toEqual([]);
    expect(sample.visibility).toBe('hidden');
    expect(sample.left).toBe(-DRAWER_WIDTH);
  });
});
