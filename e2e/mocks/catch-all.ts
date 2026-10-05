import type { Page } from '@playwright/test';

/**
 * 모든 /api 요청을 막는 안전망. beforeEach에서 가장 먼저 등록한다 — Playwright route는
 * 나중에 등록한 핸들러가 먼저 실행되므로(LIFO, playwright docs class-route.md:
 * "they run in the order opposite to their registration"), 이후 등록하는 구체적인
 * mock*이 이 캐치올을 덮어쓴다. 어떤 요청도 안 덮이면 abort로 즉시 실패해 모킹 누락을
 * 조용히 통과시키지 않는다 — 안 덮인 요청이 dev 프록시 target(vite.config.ts의 server.proxy,
 * VITE_API_BASE_URL)으로 조용히 흘러가지 않게 한다. e2e(--mode test)에서는 .env.test 값이
 * 로컬 .env의 운영 API 주소를 덮어써 2차로 막는다.
 *
 * pathname 접두사로만 판단한다(glob이 아니라 predicate 함수) — glob 문자열
 * `**\/api/**`는 Vite 자체 모듈 경로(예: .../entities/post/api/post.keys.ts)의
 * '/api/'까지 부분 매칭해 모듈 로딩 자체를 막아버렸다(2026-09-10 실측, route-match.ts
 * 참고).
 */
export async function installCatchAll(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => route.abort()
  );
}
