import type { Page } from '@playwright/test';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

/**
 * POST /auth/refresh — has-session 플래그가 있을 때만 앱 부트스트랩이 호출한다
 * (useAppInitialization.ts:50-51). accessToken은 zustand 메모리 전용이라 이 응답 하나로
 * 로그인 상태가 완성된다(auth.store.ts:41-64) — 실제 httpOnly 쿠키는 필요 없다.
 */
export async function mockAuthRefresh(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.refresh),
    (route) => route.fulfill({ json: wrapResponse(mockLoginResponse) })
  );
}
