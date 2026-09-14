import { test, expect } from './fixtures/auth.fixture';
import { installCatchAll } from './mocks/catch-all';
import { mockAuthRefresh } from './mocks/auth.mock';
import { mockCategoryOptions } from './mocks/common.mock';
import { mockPostList } from './mocks/post.mock';
import { isApiPath } from './mocks/route-match';
import { ENDPOINTS } from './mocks/endpoints';
import { TEXTS } from '@/shared/config/texts';
import type { Route } from '@playwright/test';

function fulfillNotLoggedIn(route: Route) {
  return route.fulfill({
    status: 401,
    json: {
      status: 401,
      code: 'NOT_LOGGED_IN',
      message: '로그인이 필요합니다.',
      timestamp: new Date().toISOString(),
    },
  });
}

test.describe('세션 만료', () => {
  test('로그인 상태에서 세션이 만료되면 로그인 페이지로 이동하고, 캐시 리셋이 만든 배경 401이 토스트를 연쇄로 띄우지 않는다', async ({
    page,
  }) => {
    await installCatchAll(page);
    // has-session 플래그로 부팅 시 /auth/refresh는 성공해 accessToken을 얻는다(isAuthenticated
    // true) — 그 뒤 Navbar가 항상 자동 호출하는 GET /auth/account만 서버가 세션 만료로
    // 판단해 401을 돌려주는 상황을 재현한다. /post는 공개 라우트라 ProtectedRoute의 자체
    // 리다이렉트(로그아웃/세션만료 시 조용히 /post로 보내는 경로, ProtectedRoute.tsx)와
    // 경합하지 않아, client.ts·queryClient.ts의 401 처리만 순수하게 관찰할 수 있다.
    await mockAuthRefresh(page);
    await mockCategoryOptions(page);
    await mockPostList(page);
    await page.route((url) => isApiPath(url, ENDPOINTS.auth.account), fulfillNotLoggedIn);

    await page.goto('/post');

    // client.ts의 401 인터셉터가 AuthUtil.clearAll()을 호출해 /auth/login으로 이동시킨다.
    // 실측: 이 이동이 목록 렌더보다 먼저 관측될 만큼 빠르다 — "목록이 잠깐 보인다"는
    // 별도로 단언하지 않는다(타이밍 의존적이라 flaky 위험만 늘린다).
    await expect(page).toHaveURL(/\/auth\/login$/);

    // 실측(계획 당시 예상과 다름): client.ts가 이 401을 처리하며 AuthUtil.clearAll()을
    // 먼저 호출해 AuthUtil.isLoggingOut()을 true로 만들어버리므로, 같은 에러가 곧이어
    // QueryCache.onError(queryClient.ts)에도 전파되지만 그 가드에 걸려 'loginRequired'
    // 토스트조차 뜨지 않는다 — "로그인 필요 토스트 1개"가 아니라 "토스트가 전혀 없이
    // 조용히 이동"이 실제 동작이다. clearAll()은 이제 clearQueriesWithoutRefetch()를
    // 써서 애초에 배경 재요청 자체를 내지 않으므로(auth.util.ts, docs/AUTH.md §8-E)
    // 그로 인한 401도 안 생긴다 — 남은 방어선은 로그아웃 시점에 이미 떠 있던 요청의
    // 뒤늦은 401뿐이고, 이것도 isLoggingOut()의 유예 창(LOGOUT_GRACE_MS)이 같은
    // 가드로 억제한다. client.test.ts는 마운트된 쿼리 옵저버가 없어 이 가드를
    // 구조적으로 검증할 수 없었던 지점이다.
    await expect(page.getByText(TEXTS.messages.error.loginRequired)).toHaveCount(0);
    await expect(page.getByText(TEXTS.messages.error.serverError)).toHaveCount(0);
  });
});
