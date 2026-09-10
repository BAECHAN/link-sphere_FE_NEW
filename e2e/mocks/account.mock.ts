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

/**
 * GET /auth/account/nickname-availability — useUpdateAccount.ts:92,118-121의 500ms
 * 디바운스가 끝난 뒤에만 나가는 중복 검사 요청. isApiPath가 정확 일치라 '/auth/account'
 * 목과 pathname이 겹치지 않는다(실측 확인).
 */
export async function mockNicknameAvailability(page: Page, available = true): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.nicknameAvailability),
    (route) => route.fulfill({ json: wrapResponse({ available }) })
  );
}

/**
 * PATCH /auth/account → 409(닉네임 중복).
 * ⚠️ GET(mockAccountQuery)과 pathname이 완전히 같다(api.ts의 account/updateAccount가
 * 동일 문자열) — isApiPath는 method를 보지 않으므로 반드시 mockAccountQuery 다음에
 * 등록하고(LIFO로 이게 먼저 실행됨), PATCH가 아니면 route.fallback()으로 넘겨야 한다.
 * 반대로 두면 GET /auth/account가 409를 받아 "계정 정보 조회에 실패했어요." 토스트만
 * 뜨고 끝난다. 응답 body의 status는 HTTP status가 아니라 ApiError가 읽는 필드다
 * (common.type.ts의 ApiError 생성자가 data.status를 그대로 옮겨쓴다) — 여기 안 넣으면
 * account.queries.ts의 `error.status === 409` 분기를 못 타 일반 실패 메시지가 뜬다.
 */
export async function mockAccountUpdateConflict(page: Page): Promise<void> {
  await page.route(
    (url) => isApiPath(url, ENDPOINTS.auth.account),
    (route) => {
      if (route.request().method() !== 'PATCH') {
        return route.fallback();
      }
      return route.fulfill({
        status: 409,
        json: {
          status: 409,
          code: 'DUPLICATE_NICKNAME',
          message: '이미 사용 중인 닉네임입니다.',
          timestamp: new Date().toISOString(),
        },
      });
    }
  );
}
