import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';

/**
 * 세션 존재 플래그 키.
 *
 * 리프레시 토큰은 httpOnly 쿠키라 JS가 읽을 수 없다. 그래서 "세션이 있을 가능성"만
 * 불리언으로 남겨, 비로그인 방문자가 첫 로딩마다 /auth/refresh를 호출하는 것을 막는다.
 * 토큰 등 민감정보는 절대 저장하지 않는다.
 *
 * 플래그와 실제 쿠키가 어긋나면(쿠키만 만료) refresh가 401을 내고 clearAuth로 플래그가
 * 정리되므로 자가 복구된다.
 */
const SESSION_FLAG_KEY = STORAGE_KEYS.AUTH.HAS_SESSION;

export const hasStoredSession = (): boolean =>
  LocalStorageUtil.getItem<boolean>(SESSION_FLAG_KEY) === true;

/** 로그인이 풀렸는데 화면을 떠나지 않고 그 자리에 둔 이유 - 로그인 창 문구가 이 값으로 갈린다 */
export type SignedOutInPlaceReason = 'expired' | 'signedOutElsewhere';

/**
 * 로그인이 풀렸지만 쓰던 화면에 그대로 둔 상태(docs/plans/2026-10-28-keep-writing-in-place.md). 이 값이 있는 동안에는
 * 보호 화면이 그대로 남고(ProtectedRoute), 세션 무효 응답은 조용히 끝나며(client.ts·error-toast.ts), 로그아웃 상태여도
 * 이탈 확인창이 동작한다(useUnsavedChangesGuard). pathname은 값을 세운 화면이다 - 그 화면을 떠나면 내린다.
 */
export interface SignedOutInPlace {
  reason: SignedOutInPlaceReason;
  pathname: string;
}

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  /** 앱 시작 시 인증 복원 시도가 끝났는지. ProtectedRoute가 이 값을 기다린다. */
  isAuthResolved: boolean;
  signedOutInPlace: SignedOutInPlace | null;
  setAuth: (token: string | null) => void;
  setAccessToken: (token: string | null) => void; // 하위 호환성 유지
  setAuthResolved: (resolved: boolean) => void;
  clearAuth: () => void;
  /**
   * 이 탭의 메모리 토큰만 지운다 - 세션 플래그 등 localStorage는 건드리지 않는다. 다른 탭에서 일어난
   * 로그아웃·로그인을 이 탭에 반영할 때 쓴다(useAuthEpochSync): 그 값은 다른 탭이 이미 최종값으로
   * 써 뒀고, clearAuth처럼 지우면 다른 탭이 방금 만든 세션 플래그를 깨뜨린다.
   */
  clearLocalAuth: () => void;
  /** 로그인 만료 - clearAuth와 같이 정리하고, 같은 set에서 그 화면에 둔다는 표시를 세운다(AuthUtil.applySessionExpired) */
  expireSession: (pathname: string) => void;
  /** 쓰는 중에 다른 탭이 로그아웃했다 - clearLocalAuth와 같이 정리하고, 같은 set에서 그 화면에 둔다는 표시를 세운다 */
  clearLocalAuthInPlace: (pathname: string) => void;
  /** 표시를 세운 화면과 다른 화면으로 옮겨 갔으면 내린다. 같은 화면 안의 이동(로그인 창 열고 닫기)은 그대로 둔다 */
  leaveSignedOutInPlace: (pathname: string) => void;
}

/** 세션 플래그는 인증 상태 변경 지점에서만 갱신한다 (단일 소유) */
const syncSessionFlag = (token: string | null) => {
  if (token) {
    LocalStorageUtil.setItem(SESSION_FLAG_KEY, true);
  } else {
    LocalStorageUtil.removeItem(SESSION_FLAG_KEY);
  }
};

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      accessToken: null,
      isAuthenticated: false,
      isAuthResolved: false,
      signedOutInPlace: null,
      // 토큰을 넣고 뺄 때마다 그 토큰이 속한 인증 세대를 맞춘다(client.ts가 요청 시작 때 기억해 401 때 비교).
      // 세대 "쓰기"는 여기서 하지 않는다 - 그건 명시적 로그인·로그아웃 호출부의 몫이다(auth-epoch.util.ts)
      setAuth: (token) => {
        syncSessionFlag(token);
        set({ accessToken: token, isAuthenticated: !!token, signedOutInPlace: null });
        AuthEpochUtil.bindToken();
      },
      setAccessToken: (token) => {
        syncSessionFlag(token);
        set({ accessToken: token, isAuthenticated: !!token, signedOutInPlace: null });
        AuthEpochUtil.bindToken();
      },
      setAuthResolved: (resolved) => set({ isAuthResolved: resolved }),
      // 제자리에 둘 이유가 없는 로그아웃(clearAll·직접 로그아웃·앱 시작 복원 실패)이라 제자리 표시도 함께 내린다
      clearAuth: () => {
        syncSessionFlag(null);
        LocalStorageUtil.removeItem(STORAGE_KEYS.AUTH.LAST_AVATAR);
        set({ accessToken: null, isAuthenticated: false, signedOutInPlace: null });
        AuthEpochUtil.bindToken();
      },
      clearLocalAuth: () => {
        set({ accessToken: null, isAuthenticated: false });
        AuthEpochUtil.bindToken();
      },
      expireSession: (pathname) => {
        syncSessionFlag(null);
        LocalStorageUtil.removeItem(STORAGE_KEYS.AUTH.LAST_AVATAR);
        set({
          accessToken: null,
          isAuthenticated: false,
          signedOutInPlace: { reason: 'expired', pathname },
        });
        AuthEpochUtil.bindToken();
      },
      clearLocalAuthInPlace: (pathname) => {
        set({
          accessToken: null,
          isAuthenticated: false,
          signedOutInPlace: { reason: 'signedOutElsewhere', pathname },
        });
        AuthEpochUtil.bindToken();
      },
      leaveSignedOutInPlace: (pathname) => {
        const { signedOutInPlace } = get();

        if (!signedOutInPlace || signedOutInPlace.pathname === pathname) {
          return;
        }

        set({ signedOutInPlace: null });
      },
    }),
    { name: 'auth-store' }
  )
);
