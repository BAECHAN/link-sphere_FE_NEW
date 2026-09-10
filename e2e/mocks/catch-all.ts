import type { Page } from '@playwright/test';

/**
 * 모든 /api 요청을 막는 안전망. beforeEach에서 가장 먼저 등록한다 — Playwright route는
 * 나중에 등록한 핸들러가 먼저 실행되므로(LIFO, playwright docs class-route.md:
 * "they run in the order opposite to their registration"), 이후 등록하는 구체적인
 * mock*이 이 캐치올을 덮어쓴다. 어떤 요청도 안 덮이면 abort로 즉시 실패해 모킹 누락을
 * 조용히 통과시키지 않는다 — dev 프록시 target이 실제 AWS Lambda라 안 덮이면 실서버로
 * 샐 수 있다(vite.config.ts:13,148).
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
