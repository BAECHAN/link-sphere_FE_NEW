import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

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

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  /** 앱 시작 시 인증 복원 시도가 끝났는지. ProtectedRoute가 이 값을 기다린다. */
  isAuthResolved: boolean;
  setAuth: (token: string | null) => void;
  setAccessToken: (token: string | null) => void; // 하위 호환성 유지
  setAuthResolved: (resolved: boolean) => void;
  clearAuth: () => void;
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
    (set) => ({
      accessToken: null,
      isAuthenticated: false,
      isAuthResolved: false,
      setAuth: (token) => {
        syncSessionFlag(token);
        set({ accessToken: token, isAuthenticated: !!token });
      },
      setAccessToken: (token) => {
        syncSessionFlag(token);
        set({ accessToken: token, isAuthenticated: !!token });
      },
      setAuthResolved: (resolved) => set({ isAuthResolved: resolved }),
      clearAuth: () => {
        syncSessionFlag(null);
        LocalStorageUtil.removeItem(STORAGE_KEYS.AUTH.LAST_AVATAR);
        set({ accessToken: null, isAuthenticated: false });
      },
    }),
    { name: 'auth-store' }
  )
);
