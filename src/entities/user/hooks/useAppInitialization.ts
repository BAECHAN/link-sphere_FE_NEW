import { useEffect, useRef } from 'react';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { useAuthStore, hasStoredSession } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';

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

    const initialize = async () => {
      try {
        // 리프레시 쿠키가 있을 가능성이 있을 때만 호출한다.
        // 비로그인 방문자는 여기서 네트워크 요청 없이 즉시 끝난다.
        if (!accessToken && hasStoredSession()) {
          await restoreAuth();
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
