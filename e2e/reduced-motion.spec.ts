import { test, expect, type Page } from '@playwright/test';
import { installCatchAll } from './mocks/catch-all';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { TEXTS } from '@/shared/config/texts';

// globals.css 끝의 @media (prefers-reduced-motion: reduce) 블록 — 움직임(이동·확대·회전)만 빼고
// 페이드·색 변화는 남기며, 스피너는 느리게 돌린다. jsdom은 CSS를 적용하지 않아 브라우저에서만 확인된다.
const CASES = [
  { reducedMotion: 'no-preference', enterScale: /95/, keepsTransform: true, spinDuration: '1s' },
  { reducedMotion: 'reduce', enterScale: /^1$/, keepsTransform: false, spinDuration: '2s' },
] as const;

async function openLoginDialog(page: Page) {
  // 비로그인으로 좋아요를 누르면 로그인 모달이 뜬다(guest-guard.spec.ts)
  await page.getByRole('button', { name: TEXTS.ariaLabels.postLike, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: TEXTS.auth.guard.title });
  await expect(dialog).toBeVisible();

  return dialog;
}

for (const c of CASES) {
  test.describe(`prefers-reduced-motion: ${c.reducedMotion}`, () => {
    test.beforeEach(async ({ page }) => {
      await installCatchAll(page);
      await mockCategoryOptions(page);
      await mockPostList(page);
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
      // /post에서 aria-busy 속성은 PostCard만 단다(PostCard.tsx)
      const card = page.locator('[aria-busy="false"]').first();
      await expect(card).toBeVisible();
      const transitionProperty = await card.evaluate(
        (el) => getComputedStyle(el).transitionProperty
      );

      expect(transitionProperty.includes('transform')).toBe(c.keepsTransform);
      expect(transitionProperty).toContain('box-shadow');
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
