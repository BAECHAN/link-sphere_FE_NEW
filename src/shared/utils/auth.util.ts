import { useAuthStore } from '@/shared/store/auth.store';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { NavigationService } from '@/shared/lib/router/navigation';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

export class AuthUtil {
  /** resetQueries()로 인한 배경 재요청이 아직 진행 중인지 (isLoggingOut 참고) */
  private static loggingOut = false;

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
   * clearQueries()가 트리거한 배경 재요청이 응답을 기다리는 중인지 확인한다.
   *
   * 로그아웃 처리 중 resetQueries()가 화면에 남아있던 쿼리를 재요청하는데, 그중
   * 인증이 필요한 쿼리는 토큰이 이미 지워진 뒤라 401로 응답받는다. 이건 세션이
   * 만료된 게 아니라 로그아웃 레이스일 뿐이므로 로그인 페이지로 재이동하면 안 된다.
   * (isAuthenticated로 판단하면 "원래부터 로그아웃 상태에서 인증이 필요한 동작을
   * 시도한" 정상적인 401까지 함께 막아버리므로, 재요청이 실제로 진행 중인 좁은
   * 구간만 별도 플래그로 좁힌다.)
   */
  static isLoggingOut(): boolean {
    return this.loggingOut;
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

  static clearAll(redirectTo: string = ROUTES_PATHS.AUTH.LOGIN): void {
    this.clearAuth();
    this.clearQueries();
    NavigationService.navigate(redirectTo, { replace: true });
  }
}
