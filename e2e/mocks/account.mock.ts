import type { Page } from '@playwright/test';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { ENDPOINTS } from './endpoints';
import { isApiPath } from './route-match';
import { wrapResponse } from './wrap-response';

/**
 * GET /auth/account — 로그인 상태(isAuthenticated)가 되는 순간 Navbar가 항상 자동
 * 호출한다(useAccount.ts → useFetchAccountQuery, Navbar.tsx:37). 안 모킹해두면 캐치올에
 * 막혀 "계정 정보 조회에 실패했어요." 토스트가 뜬다 — 어서션이 이 토스트를 체크하지
 * 않으면 테스트 자체는 통과해버려서 놓치기 쉽다(2026-09-10, 영상 재생 중 실측). auth
 * 상태를 세팅하는 스펙은 모두 이 모킹도 함께 등록해야 한다.
 */
export async function mockAccountQuery(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.account),
    (route) => route.fulfill({ json: wrapResponse(mockAccount) })
  );
}
