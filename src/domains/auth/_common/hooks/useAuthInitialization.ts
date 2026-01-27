import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

/**
 * 앱 초기 로드 시 리프레시 토큰을 이용해 인증 세션을 복구합니다.
 */
export const useAuthInitialization = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { restoreAuth } = useAuth();

  useEffect(() => {
    const initializeAuth = async () => {
      await restoreAuth();
      setIsInitialized(true);
    };

    initializeAuth();
  }, [restoreAuth]);

  return { isInitialized };
};
