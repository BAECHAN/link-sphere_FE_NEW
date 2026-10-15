import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { authApi } from '@/entities/auth/api/auth.api';
import { handleSessionAdoptedSuccess } from '@/entities/auth/api/auth.keys';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { hasStoredSession, useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { AuthUtil } from '@/shared/utils/auth.util';
import { ErrorUtil } from '@/shared/utils/error.util';

// 아래 두 함수는 이벤트가 온 시점의 스토어 값을 읽어야 해서 훅 밖 모듈 함수로 둔다 - 훅 안의 getState()는
// eslint.config.js의 no-restricted-syntax가 막는다(선례: useUnsavedChangesGuard.ts의 shouldBlockNavigation).

/**
 * 쿠키로 지금 세션을 받아 이 탭의 인증으로 삼는다. useAuth().restoreAuth는 렌더 시점 토큰으로 조기
 * 반환해 이벤트 핸들러에서 쓸 수 없고, 실패 때 clearAuth로 다른 탭의 세션 플래그까지 지운다 - 여기서는
 * 실패해도 이 탭만 정리한다(onFailure, 실패 원인을 넘긴다). FCM 등록은 로그인한 탭이 이미 했다.
 */
async function adoptSessionFromCookie(
  queryClient: QueryClient,
  onFailure: (error?: unknown) => void,
  onSuccess?: () => void
) {
  // 이 탭에 열려 있던 로그인 모달의 "로그인 후 할 일"이 다른 탭의 로그인으로 실행되지 않게 한다
  const { setOnSuccess, setPendingAction } = useLoginDialogStore.getState();
  setOnSuccess(undefined);
  setPendingAction(undefined);

  try {
    const authData = await authApi.refresh();

    if (!authData?.accessToken) {
      onFailure();
      return;
    }

    useAuthStore.getState().setAuth(authData.accessToken);
    handleSessionAdoptedSuccess(queryClient);
    onSuccess?.();
  } catch (error) {
    console.error('[AUTH] Failed to adopt session from another tab', error);
    onFailure(error);
  }
}

/**
 * 인증 세대가 이 페이지가 알던 값과 달라졌으면 이 탭의 인증을 맞춘다.
 *
 * @param fromOtherTab 살아 있는 탭이 다른 탭의 storage 이벤트를 받은 경우. 탭 복귀·bfcache 복원 때는
 *   그 사이 로그아웃이 있었는지 알 수 없어 false로 엄격하게 처리한다.
 */
function reconcileAuthEpoch(queryClient: QueryClient, fromOtherTab: boolean) {
  if (!AuthEpochUtil.isStale()) {
    return;
  }

  AuthEpochUtil.acknowledge();
  const { accessToken, isAuthResolved, clearLocalAuth } = useAuthStore.getState();
  const signedInElsewhere = AuthEpochUtil.isLoginEpoch() && hasStoredSession();

  // 살아 있는 탭이 로그인 이벤트를 받았는데 토큰을 들고 있다 - 명시적 로그아웃이었다면 이 탭은 이미 그
  // 이벤트를 받아 로그아웃됐을 것이므로, 조용히 세션을 잃은 탭에서 같은 사람이 다시 로그인한 경우다.
  // 내보내면 작성 중이던 폼이 사라지므로 이동 없이 새 세션을 받아들인다.
  // 받아들이기가 실패하면 로그아웃 처리로 끝낸다 - 방금 같은 쿠키로 refresh가 실패했으니 다시 복원하지 않는다.
  // 단 실패 원인이 SESSION_MISMATCH(쿠키는 유효, 다른 계정)면 토큰 없이 다시 복원한다(아래).
  if (accessToken && fromOtherTab && signedInElsewhere) {
    void adoptSessionFromCookie(queryClient, (error) => {
      AuthUtil.applySignOutFromElsewhere();

      // 같은 사람이 아니었다 - BE가 이 탭 토큰과 쿠키 주인이 다른 회원이라며 거절했다(SESSION_MISMATCH). 화면을 그대로
      // 둔 채 그 계정이 되면 이전 계정으로 쓰던 폼이 새 계정으로 제출되므로, 로그아웃 처리(보호 경로면 /post) 뒤
      // 쿠키 주인 계정으로 복원한다 - bfcache 복원 때와 같은 엄격한 처리다. 토큰을 비웠으니 두 번째 refresh는 헤더 없이
      // 나가 성공한다. 세대가 바뀐 경로라 옛 토큰으로 나간 요청은 client.ts·mutation-auth-epoch.ts가 이미 막는다.
      if (ErrorUtil.isSessionMismatch(error)) {
        void adoptSessionFromCookie(queryClient, clearLocalAuth, () =>
          toast.info(TEXTS.messages.info.switchedToOtherAccount)
        );
      }
    });
    return;
  }

  if (accessToken) {
    AuthUtil.applySignOutFromElsewhere();
  }

  // 앱 시작 복원이 아직 진행 중이면 그쪽이 같은 일을 한다(같은 탭에서 refresh가 두 번 나가지 않게)
  if (signedInElsewhere && isAuthResolved) {
    void adoptSessionFromCookie(queryClient, clearLocalAuth);
  }
}

/**
 * 다른 탭의 로그인·로그아웃과, bfcache에 멈춰 있던 사이의 인증 변화를 이 탭에 맞춘다(docs/AUTH.md §8-H).
 *
 * 토큰을 들고 있으면 이 탭만 로그아웃 처리하고(보호 경로면 /post로), 저장된 세대가 로그인이면 쿠키로
 * 세션을 복원한다 - 새로 연 탭과 같은 상태가 된다. 새로고침(location.reload)하지 않는 이유: 작성 중인 폼이
 * 있으면 이탈 확인창이 뜨고, 취소하면 이전 사용자 화면이 그대로 남는다.
 *
 * 확인 시점은 다른 탭의 storage 이벤트, 탭이 다시 보일 때, bfcache 복원(pageshow persisted)이다. bfcache
 * 복원 때는 visibilitychange가 pageshow보다 먼저 와서(Chromium 실측) 그때 확인해야 React Query가 옛 토큰으로
 * 재조회하기 전에 정리된다 - 그래서 TanStack Query가 듣는 window가 아니라 document에 단다(이벤트가 document를
 * 먼저 지난다).
 *
 * 브라우저 이벤트 구독이라 effect로 붙이고 cleanup에서 뗀다(https://react.dev/learn/synchronizing-with-effects).
 * AuthProvider 한 곳에서만 호출한다.
 */
export const useAuthEpochSync = () => {
  const queryClient = useQueryClient();

  useEffect(
    function reconcileAuthWithOtherTabs() {
      const handleStorage = (event: StorageEvent) => {
        // key가 null이면 다른 탭이 localStorage.clear()를 부른 것이다
        if (event.key === STORAGE_KEYS.AUTH.EPOCH || event.key === null) {
          reconcileAuthEpoch(queryClient, true);
        }
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          reconcileAuthEpoch(queryClient, false);
        }
      };

      const handlePageShow = (event: PageTransitionEvent) => {
        if (event.persisted) {
          reconcileAuthEpoch(queryClient, false);
        }
      };

      window.addEventListener('storage', handleStorage);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pageshow', handlePageShow);

      return () => {
        window.removeEventListener('storage', handleStorage);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow);
      };
    },
    [queryClient]
  );
};
