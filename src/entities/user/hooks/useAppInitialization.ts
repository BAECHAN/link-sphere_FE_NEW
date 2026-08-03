import { useEffect, useRef } from 'react';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { useAuthStore, hasStoredSession } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';
import { handleAuthRestoreSuccess } from '@/entities/user/api/auth.keys';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { getTransformedImageUrl } from '@/shared/lib/image/supabaseImage';

/**
 * 지난 방문에서 저장해둔 아바타 URL을 즉시 워밍한다.
 * /auth/refresh → /auth/account 왕복이 끝나기 전에 이미지 요청을 먼저 출발시켜,
 * 계정 응답이 도착했을 때 같은 URL이면 브라우저 캐시로 바로 그려지게 한다.
 */
function prefetchLastAvatar(): void {
  const cached = LocalStorageUtil.getItem<string>(STORAGE_KEYS.AUTH.LAST_AVATAR);
  if (cached) {
    new Image().src = getTransformedImageUrl(cached, { width: 64 });
  }
}

/**
 * 앱 초기화 전담 훅
 * 이전에 로그인한 흔적이 있을 때만 토큰 복원을 시도한다.
 *
 * 이 훅은 화면을 막지 않는다. 복원은 백그라운드로 진행되고, 완료 여부는
 * auth.store의 isAuthResolved로 알린다(ProtectedRoute가 이 값을 기다린다).
 */
export const useAppInitialization = () => {
  const { restoreAuth, accessToken } = useAuth();
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved);
  const hasInitialized = useRef(false);

  useEffect(function restoreSessionOnMount() {
    // 중복 실행 방지
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    // 인증 복원을 기다리지 않고 먼저 출발시킨다 (병렬 워밍)
    prefetchLastAvatar();

    const initialize = async () => {
      try {
        // 리프레시 쿠키가 있을 가능성이 있을 때만 호출한다.
        // 비로그인 방문자는 여기서 네트워크 요청 없이 즉시 끝난다.
        if (!accessToken && hasStoredSession()) {
          const restored = await restoreAuth();
          if (restored) {
            handleAuthRestoreSuccess();
          }
        }
      } catch (error) {
        console.error(TEXTS.messages.error.appInitFailed, error);
      } finally {
        setAuthResolved(true);
      }
    };

    void initialize();
    // 마운트 시 1회만 실행한다. accessToken/restoreAuth를 의존성에 넣으면
    // 복원 성공으로 토큰이 바뀔 때 재실행된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
