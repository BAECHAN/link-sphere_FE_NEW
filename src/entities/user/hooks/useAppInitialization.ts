import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/entities/user/hooks/useAuth';

/**
 * 앱 초기화 전담 훅
 * 리프레시 토큰이 있으면 토큰 복원 시도
 */
export const useAppInitialization = () => {
  const { restoreAuth, accessToken } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // 중복 실행 방지
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initialize = async () => {
      try {
        // 조건: 리프레시 토큰이 있고 액세스 토큰이 없는 경우
        if (!accessToken) {
          await restoreAuth();
        }
      } catch (error) {
        console.error('앱 초기화 실패:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, [accessToken, restoreAuth]);

  return { isInitialized };
};
