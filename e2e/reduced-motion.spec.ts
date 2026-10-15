import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostListPaged } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';

// globals.css 끝의 @media (prefers-reduced-motion: reduce) 블록 — 움직임(이동·확대·회전)만 빼고
// 페이드·색 변화는 남기며, 스피너는 느리게 돌린다. jsdom은 CSS를 적용하지 않아 브라우저에서만 확인된다.
const CASES = [
  {
    reducedMotion: 'no-preference',
    enterScale: /95/,
    keepsTranslate: true,
    spinDuration: '1s',
    entering: ['opacity', 'scale', 'translate'],
  },
  {
    reducedMotion: 'reduce',
    enterScale: /^1$/,
    keepsTranslate: false,
    spinDuration: '2s',
    entering: ['opacity'],
  },
] as const;

async function openLoginDialog(page: Page) {
  // 비로그인으로 좋아요를 누르면 로그인 모달이 뜬다(guest-guard.spec.ts)
  await page.getByRole('button', { name: TEXTS.ariaLabels.postLike, exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
  await expect(dialog).toBeVisible();

  return dialog;
}

// 첫 게시글 카드 — PostCard와 그 목록 래퍼(PostList.tsx) 모두 aria-busy를 달아서, 카드 안의
// 좋아요 버튼에서 가장 가까운 aria-busy 조상을 고른다
const firstPostCard = (page: Page) =>
  page
    .getByRole('button', { name: TEXTS.ariaLabels.postLike, exact: true })
    .first()
    .locator('xpath=ancestor::*[@aria-busy][1]');

for (const c of CASES) {
  test.describe(`prefers-reduced-motion: ${c.reducedMotion}`, () => {
    test.beforeEach(async ({ page }) => {
      await installCatchAll(page);
      await mockCategoryOptions(page);
      // 맨 위로 버튼이 뜰 만큼(300px 넘게) 스크롤할 수 있도록 글을 넉넉히 둔다
      await mockPostListPaged(page, { total: 20 });
      await page.emulateMedia({ reducedMotion: c.reducedMotion });
      await page.goto('/post');
    });

    test('다이얼로그 등장 확대(zoom-in-95)', async ({ page }) => {
      const dialog = await openLoginDialog(page);
      const enterScale = await dialog.evaluate((el) =>
        getComputedStyle(el).getPropertyValue('--tw-enter-scale').trim()
      );

      expect(enterScale).toMatch(c.enterScale);

      // 페이드는 남으므로 퇴장 애니메이션이 끝나 정상으로 사라져야 한다(Radix Presence)
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    test('게시글 카드 hover 들림의 트랜지션 대상', async ({ page }) => {
      const card = firstPostCard(page);
      await expect(card).toBeVisible();
      const transitionProperty = await card.evaluate(
        (el) => getComputedStyle(el).transitionProperty
      );

      // -translate-y-0.5는 Tailwind v4에서 transform이 아니라 translate 속성이다
      expect(transitionProperty.includes('translate')).toBe(c.keepsTranslate);
      expect(transitionProperty).toContain('box-shadow');
    });

    test('맨 위로 버튼 등장 트랜지션', async ({ page }) => {
      // 버튼은 보이는 상태로 바로 마운트된다 — 처음 그려질 때(@starting-style) 시작한 트랜지션을
      // 마운트 순간에 모은다
      await expect(firstPostCard(page)).toBeVisible();
      await page.evaluate(() => {
        new MutationObserver((_, observer) => {
          const wrapper = document.querySelector('[aria-label="Scroll to top"]')?.parentElement;

          if (!wrapper) {
            return;
          }

          observer.disconnect();
          // getAnimations()가 스타일을 먼저 갱신하므로 이 시점에 시작된 트랜지션이 잡힌다
          (window as unknown as { __entering: string[] }).__entering = wrapper
            .getAnimations()
            .map((animation) => (animation as CSSTransition).transitionProperty)
            .sort();
        }).observe(document.body, { childList: true, subtree: true });
      });

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));

      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { __entering?: string[] }).__entering)
        )
        .toEqual(c.entering);
    });

    test('스피너 한 바퀴 시간', async ({ page }) => {
      // 로딩 타이밍에 기대지 않도록 animate-spin 요소를 직접 넣어 잰다
      const spinDuration = await page.evaluate(() => {
        const el = document.createElement('div');
        el.className = 'animate-spin';
        document.body.append(el);
        const duration = getComputedStyle(el).animationDuration;
        el.remove();

        return duration;
      });

      expect(spinDuration).toBe(c.spinDuration);
    });
  });
}
