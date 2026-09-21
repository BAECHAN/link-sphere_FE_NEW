/**
 * 로그아웃 직후 "처리 중" 유예 창 상태.
 *
 * clearAll()/clearQueries()(auth.util.ts)가 캐시를 정리한 뒤에도 화면에 떠 있던
 * 요청이 뒤늦게 401로 돌아오는 짧은 구간이 있다 - 세션이 만료된 게 아니라 로그아웃
 * 레이스일 뿐이므로 이 구간에는 로그인 페이지로 재이동하거나 토스트를 띄우면 안 된다.
 * 이 유예 여부(isLoggingOut)를 auth.util.ts와 queryClient.ts 양쪽이 참조해야 하는데,
 * 상태 자체는 queryClient를 전혀 건드리지 않으므로 의존성 0인 이 파일로 분리해
 * 둘 사이의 순환 참조를 막는다.
 */

/**
 * clearAll() 직후 "로그아웃 처리 중"으로 간주하는 유예 시간.
 *
 * clearQueries()는 resetQueries()가 돌려주는 Promise에 플래그를 묶을 수 있지만,
 * clearAll()은 재요청을 아예 하지 않으므로 붙잡을 Promise가 없다. 대신 로그아웃
 * 시점에 이미 떠 있던 요청 - 어떤 queryFn도 AbortSignal을 apiClient에 넘기지 않아
 * cancelQueries()로도 실제로 끊기지 않는다 - 의 401이 돌아오는 구간만 창으로 덮는다.
 * 이 401을 놓치면 client.ts:219 가드가 풀려 clearAll()이 기본값(/auth/login)으로
 * 한 번 더 호출되고, 보호 경로 로그아웃이 /post에 도착한 직후 로그인 페이지로 튕긴다.
 * 폭은 지금까지 resetQueries() Promise가 사실상 열어두던 창(재요청 1회 + 실패 시
 * 기본 재시도 1회 = RTT + 1000ms + RTT, query-core retryer.ts의 기본 재시도 지연
 * `1000 * 2**0`)에 맞췄다.
 */
const LOGOUT_GRACE_MS = 2000;

export class LogoutGraceUtil {
  /** clearQueries()의 resetQueries() 배경 재요청이 아직 진행 중인지 (isLoggingOut 참고) */
  private static loggingOut = false;

  /** 재요청 없이 캐시를 버린(clearAll) 시각. 유예 창 판정에만 쓴다 */
  private static clearedAt = 0;

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

  /** clearQueries()가 배경 재요청(resetQueries)을 시작하기 직전에 호출한다 */
  static markBackgroundRefetchStart(): void {
    this.loggingOut = true;
  }

  /** clearQueries()의 배경 재요청(resetQueries)이 끝난 뒤 호출한다 */
  static markBackgroundRefetchEnd(): void {
    this.loggingOut = false;
  }

  /** clearQueriesWithoutRefetch()가 캐시를 지운 시각을 기록한다 */
  static markClearedAt(): void {
    this.clearedAt = Date.now();
  }

  /**
   * 테스트 격리용 - 로그아웃 유예 상태를 비운다.
   *
   * src/test/setup.ts의 전역 afterEach에는 두지 않는다 - auth.util.ts가 NavigationService/
   * queryClient를 import하므로, setup.ts(모든 테스트 파일보다 먼저 실행)에서 AuthUtil을
   * import하면 그 두 모듈이 각 테스트 파일의 vi.mock보다 먼저 "실제" 모듈로 로드·캐시돼
   * 버려 이후 어떤 파일에서 걸어도 mock이 적용되지 않는다(client.test.ts에서 실측 -
   * NavigationService.navigate mock이 전혀 호출 기록을 안 남기고 실제 window.location.href
   * 대입까지 실행됨). isLoggingOut() 유예 창을 실제로 쓰는 테스트 파일(client.test.ts,
   * auth.util.test.ts)이 각자 자기 파일의 afterEach에서 AuthUtil.resetLogoutGuard()를
   * 통해 호출한다.
   */
  static reset(): void {
    this.loggingOut = false;
    this.clearedAt = 0;
  }
}
