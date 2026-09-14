import type { Page } from '@playwright/test';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
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

/** POST /auth/login (성공) — useLoginMutation.onSuccess가 accessToken을 세팅한다(auth.queries.ts:24). */
export async function mockLoginSuccess(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.login),
    (route) => route.fulfill({ json: wrapResponse(mockLoginResponse) })
  );
}

/**
 * POST /auth/login (실패, 401) — client.ts:196-210이 code가 TOKEN_EXPIRED/NOT_LOGGED_IN/
 * INVALID_TOKEN일 때만 특수 처리(refresh 시도 또는 clearAll)하므로, 그 외의 code라야
 * "토스트만 뜨고 화면 유지"하는 일반 401 경로(client.ts:213-215)를 탄다. 응답 shape는
 * 성공 응답(wrapResponse)과 다른 ApiErrorResponse(status/code/message/timestamp,
 * common.type.ts:88-93)다.
 */
export async function mockLoginFailure(page: Page, message: string): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.login),
    (route) =>
      route.fulfill({
        status: 401,
        json: {
          status: 401,
          code: 'INVALID_PASSWORD',
          message,
          timestamp: new Date().toISOString(),
        },
      })
  );
}

/** POST /auth/signup (성공) — useCreateAccountMutation.onSuccess가 /auth/login으로 이동시킨다(auth.queries.ts:100). */
export async function mockSignUpSuccess(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.signup),
    (route) => route.fulfill({ json: wrapResponse(mockAccount) })
  );
}

/** GET /auth/email-availability — useAvailabilityCheck.ts의 500ms 디바운스가 끝난 뒤 나가는 이메일 중복 검사. */
export async function mockEmailAvailability(page: Page, available = true): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.emailAvailability),
    (route) => route.fulfill({ json: wrapResponse({ available }) })
  );
}
