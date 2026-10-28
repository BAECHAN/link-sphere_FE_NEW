import { useAuthStore, type SignedOutInPlaceReason } from '@/shared/store/auth.store';
import {
  SIGNED_OUT_IN_PLACE_DIALOG_STATE,
  useLoginDialogStore,
  type LoginDialogLocationState,
} from '@/shared/store/loginDialog.store';
import { clearAllUnsavedChanges, hasUnsavedChanges } from '@/shared/store/unsavedChanges.store';
// 이 파일만 queryClient 싱글턴을 직접 import한다 — clearAll()/clearQueries()가 React 트리
// 밖에서 호출되기 때문이다(useQueryClient()를 쓸 수 없다):
//   - shared/api/client.ts의 handleTokenExpired(재시도 상한·refresh 실패)와 request()의 401 분기
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { LogoutGraceUtil } from '@/shared/utils/logout-grace.util';

// 같은 이유의 안내가 겹쳐 뜨지 않게 한다(선례: TooltipWrapper의 REASON_TOAST_ID)
const SESSION_MISMATCH_TOAST_ID = 'session-mismatch';
// 만료 안내는 닫을 때까지 남는다 - 다시 로그인하면 이 id로 닫는다(dismissSessionExpiredToast)
const SESSION_EXPIRED_TOAST_ID = 'session-expired';

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
   * mutation 캐시도 비운다 - 응답이 늦거나 오지 않는 요청의 mutation은 pending이라 GC로도 지워지지
   * 않는다(query-core mutation.ts optionalRemove). 같은 scope의 다음 mutation은 앞선 pending이 끝나야
   * 요청을 보내므로(좋아요 직렬화, interaction.queries.ts), 남겨 두면 재로그인 뒤 그 글의 좋아요
   * 요청이 그 뒤에 묶인다(docs/plans/2026-10-13-like-concurrency.md). refresh 실패로 끝나던 요청은
   * 2026-10-28부터 영원히 남지 않고 SessionExpiredError로 끝난다(client.ts expireSession).
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
   * 쓰는 중에 다른 탭(또는 bfcache에 멈춰 있던 사이)이 로그아웃했으면 화면을 떠나게 하지 않고 그 자리에서 다시
   * 로그인하게 한다 - 이동하면 쓰던 글이 확인 없이 사라진다. 쓰는 중이 아니면 applySignOutFromElsewhere 그대로다 -
   * 일부러 로그아웃할 때마다 다른 탭 모두에 로그인 창이 뜨지 않게(docs/plans/2026-10-28-keep-writing-in-place.md 결정 2).
   * 보호 경로는 캐시를 그대로 두고(ProtectedRoute가 화면을 남긴다), 공개 경로는 비로그인으로 다시 불러온다.
   */
  static reflectSignOutFromElsewhere(): void {
    if (!hasUnsavedChanges()) {
      this.applySignOutFromElsewhere();
      return;
    }

    const { pathname } = window.location;

    useAuthStore.getState().clearLocalAuthInPlace(pathname);

    if (isProtectedPath(pathname)) {
      // 그 탭이 로그아웃하기 전에 나간 요청의 늦은 응답이 안내를 띄우지 않게 applySignOutFromElsewhere와 같은 유예 창을 연다
      LogoutGraceUtil.markClearedAt();
    } else {
      this.clearQueries();
    }

    this.openSignInDialogInPlace('signedOutElsewhere');
  }

  /**
   * 로그인이 만료됐다(client.ts - refresh가 401로 거절됨, 토큰을 실은 요청이 INVALID_TOKEN) - 화면을 떠나지 않고 그
   * 자리에서 다시 로그인하게 한다(docs/plans/2026-10-28-session-expiry-draft-preservation.md 결정 1·2).
   * - 보호 경로: 캐시를 그대로 두고 로그인 창을 연다. Suspense 쿼리는 데이터가 있으면 재조회가 실패해도 화면을
   *   유지하고, ProtectedRoute가 이 표시(auth.store signedOutInPlace)를 보고 화면을 남긴다.
   * - 공개 경로: 비로그인으로 다시 불러온다. 저장 요청이 진행 중이거나 쓰는 중이면 로그인 창을 열고, 보기만 하던
   *   중이면 닫을 때까지 남는 토스트로 알린다 - 기본 4초는 다른 창에 포커스한 사이 지나간다.
   */
  static applySessionExpired(): void {
    const { pathname } = window.location;
    // 정리 전에 읽는다 - clearQueries가 화면을 Suspense로 잠깐 숨기면 입력 등록이 풀린다(useUnsavedChanges는 layout effect)
    const shouldOpenSignInDialog =
      isProtectedPath(pathname) || queryClient.isMutating() > 0 || hasUnsavedChanges();

    useAuthStore.getState().expireSession(pathname);
    // 만료 직전에 나간 다른 요청의 늦은 401이 안내를 겹쳐 띄우지 않게 clearAll과 같은 유예 창을 연다
    LogoutGraceUtil.markClearedAt();

    if (!isProtectedPath(pathname)) {
      this.clearQueries();
    }

    if (shouldOpenSignInDialog) {
      this.openSignInDialogInPlace('expired');
      return;
    }

    toast.info(TEXTS.messages.info.sessionExpired, {
      id: SESSION_EXPIRED_TOAST_ID,
      duration: Infinity,
      action: {
        label: TEXTS.buttons.login,
        onClick: () => this.openSignInDialogInPlace('expired'),
      },
    });
  }

  /**
   * 로그인이 풀린 채 둔 화면을 로그인 없이 떠났다(RouterProvider의 라우터 구독) - 그 표시를 내리고, 보호 경로였으면
   * 화면을 남기려고 두었던 캐시를 지운다. 남기면 다음 화면이 이전 회원의 계정·목록을 비로그인 상태로 보여 준다
   * (계정 조회는 꺼져도 캐시 값을 돌려줘 피드 카드에 그 회원 글의 수정·삭제 메뉴가 뜬다, usePostCard.ts isOwner).
   * 공개 경로는 로그인이 풀릴 때 이미 비로그인으로 다시 불러왔다. 새 화면이 그려지기 전이라 재요청 없이 지운다.
   */
  static leaveSignedOutInPlace(pathname: string): void {
    const { signedOutInPlace, leaveSignedOutInPlace } = useAuthStore.getState();

    if (!signedOutInPlace || signedOutInPlace.pathname === pathname) {
      return;
    }

    if (isProtectedPath(signedOutInPlace.pathname)) {
      this.clearQueriesWithoutRefetch();
    }

    leaveSignedOutInPlace(pathname);
  }

  /**
   * 다른 탭에서 다른 계정으로 로그인해 이 탭의 로그인이 풀렸다(refresh SESSION_MISMATCH - client.ts, 다른 탭의 로그인을
   * 받아들이려다 거절됨 - useAuthEpochSync) - 이 탭을 로그아웃한다. 쓰던 글은 이전 계정의 것이라 공개 화면에 두면 쿠키
   * 주인 계정으로 복원된 뒤 그 회원에게 보이므로 버리고 피드로 간다. 보호 화면은 applySignOutFromElsewhere가 이미
   * 피드로 보낸다(docs/plans/2026-10-28-keep-writing-in-place.md 결정 6).
   */
  static signOutForOtherAccount(): void {
    // 정리 전에 읽는다(applySessionExpired와 같은 이유)
    const wasWriting = hasUnsavedChanges();

    this.applySignOutFromElsewhere();

    if (wasWriting && !isProtectedPath(window.location.pathname)) {
      clearAllUnsavedChanges();
      NavigationService.navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
    }
  }

  /** 다시 로그인했으면(로그인 창, 다른 탭의 로그인을 받아들임) 남아 있는 만료 안내를 닫는다 */
  static dismissSessionExpiredToast(): void {
    toast.dismiss(SESSION_EXPIRED_TOAST_ID);
  }

  /**
   * 지금 화면 위에 로그인 창을 연다 - 로그인 창은 history state로 열린다(useHistoryOverlay). React 트리 밖이라
   * NavigationService로 같은 주소를 push한다. 이미 열려 있으면 엔트리를 더 쌓지 않고 이유만 바꾼다.
   * 창을 닫은 뒤 제출·좋아요처럼 로그인이 필요한 동작을 누를 때도 이 창을 다시 연다(useAuthGuard).
   */
  static openSignInDialogInPlace(reason: SignedOutInPlaceReason): void {
    // 이전에 열렸던 창의 "로그인 후 할 일"이 이번 로그인으로 실행되지 않게 비운다(선례: useAuthEpochSync)
    const { setOnSuccess, setPendingAction } = useLoginDialogStore.getState();
    setOnSuccess(undefined);
    setPendingAction(undefined);

    const currentState = RouterEvents.getLocation()?.state as LoginDialogLocationState | null;
    const { pathname, search } = window.location;

    // preventScrollReset: 같은 화면 위에 창만 여는 이동이다(useHistoryOverlay.open과 같은 이유)
    NavigationService.navigate(`${pathname}${search}`, {
      state: SIGNED_OUT_IN_PLACE_DIALOG_STATE[reason],
      replace: Boolean(currentState?.loginDialogOpen),
      preventScrollReset: true,
    });
  }

  /**
   * refresh가 SESSION_MISMATCH로 거절됐을 때(client.ts handleTokenExpired) - 다른 탭에서 다른 계정으로 로그인해
   * 공유 쿠키가 그 계정의 것이 됐다. 이 탭만 로그아웃하고(세션 플래그는 남겨 새로고침하면 쿠키 주인으로 복원) 이유를
   * 알린다 - 로그아웃 유예가 이어지는 SessionChangedError 토스트를 조용히 해 그대로 두면 이유 없는 로그아웃이 된다.
   * 여기서 바로 새 계정으로 바꾸지 않는다: 인증 세대가 그대로라 옛 토큰으로 나간 늦은 401이 바뀐 토큰으로 곧장
   * 재시도돼(client.ts의 "늦게 도착한 401" 분기) 새 계정으로 실행된다(docs/AUTH.md §8-B).
   */
  static applySessionMismatch(): void {
    this.signOutForOtherAccount();

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
