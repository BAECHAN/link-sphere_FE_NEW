import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockAccountQuery } from './mocks/account.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { mockBookmarkFolderList } from './mocks/bookmark-folder.mock';
import { TEXTS } from '@/shared/config/texts';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

// 모바일 북마크 폴더 시트가 닫힐 때 딤만 먼저 밝아지던 문제(2026-11-03, docs/DECISIONS.md)의 회귀 검사.
// Radix는 딤과 시트를 따로 언마운트하므로 둘의 애니메이션 끝 시각이 같아야 함께 사라진다. 닫힘 애니메이션을
// 중간(150ms)에 멈춰 세워 실제 계산된 값을 읽는다 — 클래스 이름이 아니라 화면에 나오는 결과를 본다.
interface ExitSample {
  overlayEnd: number;
  panelEnd: number;
  overlayEasing: string;
  panelEasing: string;
  overlayOpacity: number;
  panelOpacity: number;
  panelTransform: string;
  overlayBackground: string;
}

async function openSheet(page: Page) {
  await mockPostList(page);
  await page.goto('/post');
  await page.getByRole('button', { name: TEXTS.ariaLabels.bookmarkSave }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // 열린 직후 클릭 가드(useOpenClickGuard)와 열림 애니메이션이 끝나기를 기다린다
  await page.waitForTimeout(DOUBLE_CLICK_GUARD_MS);
}

function sampleExitMidway(page: Page): Promise<ExitSample> {
  return page.evaluate(async (closeLabel) => {
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    const overlay = panel?.previousElementSibling;
    const closeButton = panel?.querySelector<HTMLElement>(`button[aria-label="${closeLabel}"]`);

    if (!panel || !(overlay instanceof HTMLElement) || !closeButton) {
      throw new Error('sheet elements not found');
    }

    closeButton.click();
    await new Promise<void>((resolve) => {
      const check = () => {
        if (panel.dataset.state === 'closed' && overlay.dataset.state === 'closed') {
          resolve();
          return;
        }

        requestAnimationFrame(check);
      };
      check();
    });

    const [panelAnimation] = panel.getAnimations();
    const [overlayAnimation] = overlay.getAnimations();

    if (!panelAnimation || !overlayAnimation) {
      throw new Error('exit animation not running');
    }

    panelAnimation.pause();
    overlayAnimation.pause();
    panelAnimation.currentTime = 150;
    overlayAnimation.currentTime = 150;
    const panelStyle = getComputedStyle(panel);
    const overlayStyle = getComputedStyle(overlay);

    return {
      overlayEnd: Number(overlayAnimation.effect?.getComputedTiming().endTime),
      panelEnd: Number(panelAnimation.effect?.getComputedTiming().endTime),
      overlayEasing: overlayStyle.animationTimingFunction,
      panelEasing: panelStyle.animationTimingFunction,
      overlayOpacity: Number(overlayStyle.opacity),
      panelOpacity: Number(panelStyle.opacity),
      panelTransform: panelStyle.transform,
      overlayBackground: overlayStyle.backgroundColor,
    };
  }, TEXTS.ariaLabels.close);
}

test.describe('모바일 북마크 폴더 시트 — 딤과 시트가 함께 닫힌다', () => {
  test.beforeEach(async ({ page }) => {
    await installCatchAll(page);
    await mockAuthRefresh(page);
    await mockAccountQuery(page);
    await mockCategoryOptions(page);
    await mockBookmarkFolderList(page);
  });

  test('딤과 시트가 같은 시간·곡선으로 끝나고, 시트는 흐려지거나 줄지 않고 아래로 밀린다', async ({
    page,
  }) => {
    await openSheet(page);

    const sample = await sampleExitMidway(page);

    expect(sample.overlayEnd).toBe(300);
    expect(sample.panelEnd).toBe(sample.overlayEnd);
    expect(sample.overlayEasing).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
    expect(sample.panelEasing).toBe(sample.overlayEasing);
    // 딤은 32%(Material 3 scrim) — 검정에 알파 0.32
    expect(sample.overlayBackground).toMatch(/0\.32\)$/);
    expect(sample.overlayOpacity).toBeGreaterThan(0);
    expect(sample.overlayOpacity).toBeLessThan(1);
    expect(sample.panelOpacity).toBe(1);
    // matrix(1, 0, 0, 1, 0, ty) — 크기는 그대로, 세로로만 밀린 상태
    expect(sample.panelTransform).toMatch(/^matrix\(1, 0, 0, 1, 0, [1-9][\d.]*\)$/);
  });

  test('동작 줄이기에서는 시트가 움직이지 않고 흐려지며 닫힌다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSheet(page);

    const sample = await sampleExitMidway(page);

    expect(sample.panelEnd).toBe(sample.overlayEnd);
    expect(sample.panelTransform).toBe('matrix(1, 0, 0, 1, 0, 0)');
    expect(sample.panelOpacity).toBeGreaterThan(0);
    expect(sample.panelOpacity).toBeLessThan(1);
  });
});
