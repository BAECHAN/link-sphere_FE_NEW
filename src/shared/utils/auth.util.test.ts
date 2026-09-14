import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement, Suspense, type ReactNode } from 'react';
import { QueryClientProvider, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/store/auth.store';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

// AuthUtil이 import하는 queryClient/NavigationService는 이 파일 안에서만 모킹한다 - 전역
// setup.ts에서 AuthUtil을 import하면 이 두 모듈이 각 테스트 파일의 vi.mock보다 먼저 "실제"
// 모듈로 로드·캐시돼버려 이후 어떤 파일의 mock도 적용되지 않는다(auth.util.ts의
// resetLogoutGuard 주석 참고, client.test.ts에서 실측).
vi.mock('@/shared/lib/react-query/config/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return {
    // setQueryData로 캐시를 심고 나중에 getQueryData/queryFn 호출 횟수로 검증하므로
    // gcTime: Infinity가 필요하다(createTestQueryClient 주석과 같은 이유).
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: 0, staleTime: 0, gcTime: Infinity } },
    }),
  };
});
vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: { navigate: vi.fn(), setNavigate: vi.fn() },
}));

import { AuthUtil } from '@/shared/utils/auth.util';

// 위 vi.mock이 이 경로를 격리된 테스트 전용 QueryClient로 통째로 교체했다. 이 import는
// 그 mock 인스턴스를 테스트 단언에서 참조하기 위한 것이지 실제 싱글턴이 아니다
// (auth.util.ts만 예외인 eslint.config.js의 ignores는 프로덕션 코드 기준이라
// 이 파일까지 포함하지 않는다).
// eslint-disable-next-line custom-query-rules/no-query-client-singleton-import
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';

/** exp(초 단위 UNIX 타임스탬프)를 가진 가짜 JWT를 만든다. payload만 검사 대상이라 서명은 의미 없다. */
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('AuthUtil.isTokenExpired', () => {
  it('exp가 충분히 남은 토큰은 false다', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(AuthUtil.isTokenExpired(makeToken({ exp }))).toBe(false);
  });

  it('exp가 이미 지난 토큰은 true다', () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    expect(AuthUtil.isTokenExpired(makeToken({ exp }))).toBe(true);
  });

  it('exp까지 30초 미만 남은 토큰은 만료로 취급한다 (여유 마진)', () => {
    const exp = Math.floor(Date.now() / 1000) + 20;
    expect(AuthUtil.isTokenExpired(makeToken({ exp }))).toBe(true);
  });

  it('점(.)이 없는 문자열은 true다', () => {
    expect(AuthUtil.isTokenExpired('not-a-jwt')).toBe(true);
  });

  it('exp가 없는 payload는 true다', () => {
    expect(AuthUtil.isTokenExpired(makeToken({ sub: 'user-1' }))).toBe(true);
  });

  it('base64가 깨진 토큰은 true다', () => {
    expect(AuthUtil.isTokenExpired('header.!!!not-base64!!!.sig')).toBe(true);
  });
});

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('AuthUtil.clearAll — 화면이 곧 사라지는 로그아웃(보호 경로·세션 만료)', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
  });

  it('화면에 떠 있는 활성 쿼리를 다시 요청하지 않는다', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useQuery({ queryKey: ['probe'], queryFn }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);

    AuthUtil.clearAll();

    // 재요청이 없다는 걸 "일정 시간 안 나옴"으로 증명할 수는 없으니, 캐시가 실제로
    // 비었는지(재요청됐다면 다시 채워져 있어야 한다)와 호출 횟수 둘 다로 고정한다.
    expect(queryClient.getQueryData(['probe'])).toBeUndefined();
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  });

  it('Suspense 쿼리도 다시 요청하지 않는다', async () => {
    const queryFn = vi.fn(() => Promise.resolve('suspense-data'));

    function SuspenseProbe() {
      const { data } = useSuspenseQuery({ queryKey: ['suspense-probe'], queryFn });
      return createElement('div', null, data);
    }

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Suspense, { fallback: 'loading' }, createElement(SuspenseProbe))
      )
    );

    await screen.findByText('suspense-data');
    expect(queryFn).toHaveBeenCalledTimes(1);

    AuthUtil.clearAll();

    // 컴포넌트는 아직 마운트된 채로 남아있다(실제 앱에서는 이 직후 ProtectedRoute가
    // <Navigate>로 언마운트시킨다 - 여기서는 clearAll() 자체가 재요청을 유발하지
    // 않는다는 것만 고정한다, auth.util.ts:82-93 주석 참고).
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
  });

  it('인증을 비우고 지정 경로로 replace 이동한다', () => {
    useAuthStore.getState().setAuth('some-token');

    AuthUtil.clearAll(ROUTES_PATHS.POST.ROOT);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
      replace: true,
    });
  });
});

describe('AuthUtil.clearQueries — 제자리 로그아웃(비보호 경로)', () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    AuthUtil.resetLogoutGuard();
  });

  it('clearAll()과 달리 화면에 떠 있는 활성 쿼리를 다시 요청한다', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useQuery({ queryKey: ['probe'], queryFn }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryFn).toHaveBeenCalledTimes(1);

    AuthUtil.clearQueries();

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });
});

describe('AuthUtil.isLoggingOut', () => {
  afterEach(() => {
    AuthUtil.resetLogoutGuard();
    vi.useRealTimers();
  });

  it('clearAll() 직후에는 true이고, 유예 시간이 지나면 false로 돌아온다', () => {
    vi.useFakeTimers();

    AuthUtil.clearAll();
    expect(AuthUtil.isLoggingOut()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(AuthUtil.isLoggingOut()).toBe(true);

    vi.advanceTimersByTime(1500);
    expect(AuthUtil.isLoggingOut()).toBe(false);
  });

  it('clearQueries()의 배경 재요청이 끝나면 false로 돌아온다', async () => {
    AuthUtil.clearQueries();
    expect(AuthUtil.isLoggingOut()).toBe(true);

    await waitFor(() => expect(AuthUtil.isLoggingOut()).toBe(false));
  });
});
