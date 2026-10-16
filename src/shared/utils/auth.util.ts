import { useAuthStore } from '@/shared/store/auth.store';
// 이 파일만 queryClient 싱글턴을 직접 import한다 — clearAll()/clearQueries()가 React 트리
// 밖에서 호출되기 때문이다(useQueryClient()를 쓸 수 없다):
//   - shared/api/client.ts:173,193,266,268 (fetch 인터셉터의 401/refresh 실패 경로)
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { LogoutGraceUtil } from '@/shared/utils/logout-grace.util';

// 같은 이유의 안내가 겹쳐 뜨지 않게 한다(선례: TooltipWrapper의 REASON_TOAST_ID)
const SESSION_MISMATCH_TOAST_ID = 'session-mismatch';

export class AuthUtil {
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
    return LogoutGraceUtil.isLoggingOut();
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
    LogoutGraceUtil.markBackgroundRefetchStart();
    void queryClient.resetQueries().finally(() => {
      LogoutGraceUtil.markBackgroundRefetchEnd();
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
   *
   * mutation 캐시도 비운다 - refresh가 실패하면 client.ts가 요청을 영원히 끝나지 않는 Promise로
   * 남기는데(handleTokenExpired), 그 mutation은 pending이라 GC로도 지워지지 않는다(query-core
   * mutation.ts optionalRemove). 같은 scope의 다음 mutation은 앞선 pending이 끝나야 요청을
   * 보내므로(좋아요 직렬화, interaction.queries.ts), 남겨 두면 재로그인 뒤 그 글의 좋아요
   * 요청이 영원히 나가지 않는다(docs/plans/2026-10-13-like-concurrency.md).
   */
  private static clearQueriesWithoutRefetch(): void {
    LogoutGraceUtil.markClearedAt();
    queryClient.removeQueries();
    queryClient.getMutationCache().clear();
  }

  static clearAll(redirectTo: string = ROUTES_PATHS.AUTH.LOGIN): void {
    this.clearAuth();
    this.clearQueriesWithoutRefetch();
    NavigationService.navigate(redirectTo, { replace: true });
  }

  /**
   * 다른 탭(또는 bfcache에 멈춰 있던 사이)의 로그아웃을 이 탭에 반영한다 - 로그아웃 분기
   * (useLogoutMutation)와 같은 정리지만 localStorage는 건드리지 않는다. 세션 플래그는 로그아웃한 탭이
   * 이미 지웠고, 그 사이 다른 탭이 새로 로그인했다면 지우면 안 된다. 로그아웃 API·FCM 해제도 그 탭이 했다.
   */
  static applySignOutFromElsewhere(): void {
    useAuthStore.getState().clearLocalAuth();

    if (isProtectedPath(window.location.pathname)) {
      this.clearQueriesWithoutRefetch();
      NavigationService.navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
      return;
    }

    this.clearQueries();
  }

  /**
   * refresh가 SESSION_MISMATCH로 거절됐을 때(client.ts handleTokenExpired) - 다른 탭에서 다른 계정으로 로그인해
   * 공유 쿠키가 그 계정의 것이 됐다. 이 탭만 로그아웃하고(세션 플래그는 남겨 새로고침하면 쿠키 주인으로 복원) 이유를
   * 알린다 - 로그아웃 유예가 이어지는 SessionChangedError 토스트를 조용히 해 그대로 두면 이유 없는 로그아웃이 된다.
   * 여기서 바로 새 계정으로 바꾸지 않는다: 인증 세대가 그대로라 옛 토큰으로 나간 늦은 401이 바뀐 토큰으로 곧장
   * 재시도돼(client.ts의 "늦게 도착한 401" 분기) 새 계정으로 실행된다(docs/AUTH.md §8-B).
   */
  static applySessionMismatch(): void {
    this.applySignOutFromElsewhere();
    // 보호 경로가 아니면 위 정리는 clearQueries를 타는데, 그 유예는 재조회가 끝나면 풀린다. 화면에 활성 쿼리가 없으면
    // 재조회가 몇 틱 만에 끝나, 이 refresh를 기다리던 mutation의 SessionChangedError가 유예가 풀린 뒤 전역 핸들러에
    // 닿아 안내와 함께 에러 토스트가 뜬다(session-mismatch-toast.test.ts). 경로와 상관없이 clearAll과 같은 유예 창을 연다.
    LogoutGraceUtil.markClearedAt();
    toast.info(TEXTS.messages.info.signedOutForOtherAccount, { id: SESSION_MISMATCH_TOAST_ID });
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
    LogoutGraceUtil.reset();
  }
}
