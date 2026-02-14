import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/domains/auth/_common/hooks/useAuth';
import { PUBLIC_PATHS } from '@/shared/config/route-paths';

/**
 * 새로고침인지 감지하는 함수
 */
const isPageRefresh = (): boolean => {
  // Navigation API를 사용한 정확한 감지
  if (typeof window !== 'undefined' && 'performance' in window) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navigation?.type === 'reload';
  }
  return false;
};

/**
 * 인증이 필요한 경로인지 확인하는 함수
 */
const isAuthRequiredPath = (pathname: string): boolean => {
  return !PUBLIC_PATHS.some((path) => pathname.startsWith(path));
};

/**
 * 앱 초기화 전담 훅
 * 새로고침 시에만 토큰 복원 시도
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
        // 토큰 복원 조건 체크
        const currentPath = window.location.pathname;
        const isAuthRequired = isAuthRequiredPath(currentPath);
        const isRefresh = isPageRefresh();

        // 조건: 인증 필요한 페이지 + 새로고침 + 토큰 없음
        if (isAuthRequired && isRefresh && !accessToken) {
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
