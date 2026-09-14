import { useAuthStore } from '@/shared/store/auth.store';
// 이 파일만 queryClient 싱글턴을 직접 import한다 — clearAll()/clearQueries()가 React 트리
// 밖에서 호출되기 때문이다(useQueryClient()를 쓸 수 없다):
//   - shared/api/client.ts:183,207 (fetch 인터셉터의 401/refresh 실패 경로)
//   - shared/lib/react-query/config/queryClient.ts:59,126 (전역 QueryCache/MutationCache 에러 핸들러)
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

/**
 * clearAll() 직후 "로그아웃 처리 중"으로 간주하는 유예 시간.
 *
 * clearQueries()는 resetQueries()가 돌려주는 Promise에 플래그를 묶을 수 있지만,
 * clearAll()은 재요청을 아예 하지 않으므로 붙잡을 Promise가 없다. 대신 로그아웃
 * 시점에 이미 떠 있던 요청 - 어떤 queryFn도 AbortSignal을 apiClient에 넘기지 않아
 * cancelQueries()로도 실제로 끊기지 않는다 - 의 401이 돌아오는 구간만 창으로 덮는다.
 * 이 401을 놓치면 client.ts:207 가드가 풀려 clearAll()이 기본값(/auth/login)으로
 * 한 번 더 호출되고, 보호 경로 로그아웃이 /post에 도착한 직후 로그인 페이지로 튕긴다.
 * 폭은 지금까지 resetQueries() Promise가 사실상 열어두던 창(재요청 1회 + 실패 시
 * 기본 재시도 1회 = RTT + 1000ms + RTT, query-core retryer.ts의 기본 재시도 지연
 * `1000 * 2**0`)에 맞췄다.
 */
const LOGOUT_GRACE_MS = 2000;

export class AuthUtil {
  /** clearQueries()의 resetQueries() 배경 재요청이 아직 진행 중인지 (isLoggingOut 참고) */
  private static loggingOut = false;

  /** 재요청 없이 캐시를 버린(clearAll) 시각. 유예 창 판정에만 쓴다 */
  private static clearedAt = 0;

  static isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return true;
      }
      const payload = JSON.parse(atob(parts[1]!)) as { exp?: number };
      if (typeof payload.exp !== 'number') {
        return true;
      }
      return Date.now() / 1000 > payload.exp - 30;
    } catch {
      return true;
    }
  }

  static clearAuth(): void {
    useAuthStore.getState().clearAuth();
  }

  /**
   * 로그아웃 직후 구간 - 배경 재요청 중이거나(clearQueries), 재요청 없이 캐시를
   * 버린 직후 유예 창 안인지(clearAll) - 인지 확인한다.
   *
   * 두 경로 모두 인증이 필요한 요청이 토큰 없이 401을 받을 수 있는데, 이건 세션이
   * 만료된 게 아니라 로그아웃 레이스일 뿐이므로 로그인 페이지로 재이동하면 안 된다.
   * (isAuthenticated로 판단하면 "원래부터 로그아웃 상태에서 인증이 필요한 동작을
   * 시도한" 정상적인 401까지 함께 막아버리므로, 로그아웃 직후의 좁은 구간만
   * 별도로 좁힌다.)
   */
  static isLoggingOut(): boolean {
    return this.loggingOut || Date.now() - this.clearedAt < LOGOUT_GRACE_MS;
  }

  /**
   * 계정이 바뀔 때 캐시 데이터를 버린다.
   *
   * clear()는 Query를 캐시 맵에서 지우면서 파괴하는데, 이미 마운트된 옵저버에는
   * 아무것도 알리지 않는다. 그래서 화면은 이전 사용자의 데이터를 계속 그리고,
   * 이후 invalidateQueries()도 맵에 없는 Query에는 도달하지 못한다.
   * resetQueries()는 옵저버를 유지한 채 상태만 되돌리고 활성 쿼리를 다시 불러온다.
   */
  static clearQueries(): void {
    queryClient.cancelQueries();
    this.loggingOut = true;
    void queryClient.resetQueries().finally(() => {
      this.loggingOut = false;
    });
  }

  /**
   * 곧 다른 화면으로 이동하는 경우(clearAll) 전용 캐시 정리 - 재요청을 하지 않는다.
   *
   * resetQueries()에는 invalidateQueries의 refetchType: 'none'에 해당하는 옵션이 없어
   * (query-core queryClient.ts) 활성 쿼리를 무조건 다시 부른다. 어차피 곧 사라질
   * 화면의 쿼리를 토큰 없이 재요청하는 것이라 전부 낭비다.
   * removeQueries()는 캐시에서 Query를 지우면서 destroy() -> cancel({silent:true})까지
   * 하고 옵저버에는 아무것도 알리지 않아, 재요청도 리렌더도 유발하지 않는다
   * (cancelQueries()를 따로 부를 필요가 없는 것도 같은 이유다).
   * "옵저버가 갱신되지 않는다"는 clear()의 단점(clearQueries 주석 참고)은 이 경로에선
   * 무해하다 - 뒤따르는 navigate가 그 화면을 통째로 언마운트하기 때문이다.
   */
  private static clearQueriesWithoutRefetch(): void {
    this.clearedAt = Date.now();
    queryClient.removeQueries();
  }

  static clearAll(redirectTo: string = ROUTES_PATHS.AUTH.LOGIN): void {
    this.clearAuth();
    this.clearQueriesWithoutRefetch();
    NavigationService.navigate(redirectTo, { replace: true });
  }

  /**
   * 테스트 격리용 - 로그아웃 유예 상태를 비운다.
   *
   * src/test/setup.ts의 전역 afterEach에는 두지 않는다 - 이 파일이 NavigationService/
   * queryClient를 import하므로, setup.ts(모든 테스트 파일보다 먼저 실행)에서 AuthUtil을
   * import하면 그 두 모듈이 각 테스트 파일의 vi.mock보다 먼저 "실제" 모듈로 로드·캐시돼
   * 버려 이후 어떤 파일에서 걸어도 mock이 적용되지 않는다(client.test.ts에서 실측 -
   * NavigationService.navigate mock이 전혀 호출 기록을 안 남기고 실제 window.location.href
   * 대입까지 실행됨). isLoggingOut() 유예 창을 실제로 쓰는 테스트 파일(client.test.ts,
   * auth.util.test.ts)이 각자 자기 파일의 afterEach에서 호출한다.
   */
  static resetLogoutGuard(): void {
    this.loggingOut = false;
    this.clearedAt = 0;
  }
}
