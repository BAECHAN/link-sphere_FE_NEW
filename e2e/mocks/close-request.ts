import type { Page } from '@playwright/test';

/**
 * Android 뒤로가기 대신 같은 닫기 요청을 Esc로 만든다. Android 뒤로가기는 Playwright로 보낼 수 없다(page.goBack()은
 * 닫기 요청이 아니라 히스토리 이동이다). window 캡처 단계에서 전파만 끊어 Radix(document 캡처)·React 키 핸들러에
 * 닿지 않게 하면, 취소되지 않은 Esc를 Chromium이 닫기 요청으로 CloseWatcher에 보낸다.
 * CloseWatcher가 하나도 없으면 아무 일도 일어나지 않는다(히스토리 이동도 없다).
 */
export async function sendCloseRequest(page: Page) {
  await page.evaluate(() => {
    window.addEventListener('keydown', (event) => event.stopImmediatePropagation(), {
      capture: true,
      once: true,
    });
  });
  await page.keyboard.press('Escape');
}
