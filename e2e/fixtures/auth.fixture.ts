import { test as base, type Page } from '@playwright/test';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

/**
 * has-session 플래그를 시딩하는 test.extend. 내장 `page` 픽스처를 오버라이드해, 이
 * fixture를 import하는 스펙은 모두 "이전 로그인 흔적이 있는" 상태에서 시작한다
 * (useAppInitialization.ts:50-51이 이 플래그를 보고 /auth/refresh를 호출한다).
 * accessToken이 zustand 메모리 전용이라(auth.store.ts:41-64) storageState로 로그인
 * 상태 자체를 저장할 수는 없다 — 이 플래그만 재현해두면 부트스트랩이 알아서
 * /auth/refresh를 호출하고, 그 응답을 모킹하면 accessToken이 세팅된다.
 *
 * /auth/refresh 모킹은 여기서 하지 않는다 — Playwright route는 나중에 등록한 핸들러가
 * 먼저 실행되므로(LIFO), 이 fixture가 먼저 등록해버리면 스펙의 beforeEach에서 등록하는
 * 캐치올(installCatchAll)에 오히려 덮여 abort된다(2026-09-10 실측 — 캐치올이 refresh
 * 요청까지 막아 로그인 상태가 안 만들어지고 로그인 모달이 뜨는 회귀가 있었다). 각 스펙의
 * beforeEach에서 installCatchAll 다음에 mockAuthRefresh를 명시적으로 호출해 등록
 * 순서를 스펙이 직접 통제한다.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, 'true');
    }, STORAGE_KEYS.AUTH.HAS_SESSION);

    await use(page);
  },
});

export { expect } from '@playwright/test';
