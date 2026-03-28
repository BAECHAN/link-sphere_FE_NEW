import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { AuthUtil } from '@/shared/utils/auth.util';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, accessToken, restoreAuth } = useAuth();
  const location = useLocation();

  // 액세스 토큰이 있지만 만료됐으면 즉시 리프레시 시도 (콘텐츠 flash 방지)
  const [isVerifying, setIsVerifying] = useState(
    () => !!accessToken && AuthUtil.isTokenExpired(accessToken)
  );

  useEffect(() => {
    if (!isVerifying) return;
    restoreAuth().finally(() => setIsVerifying(false));
  }, [isVerifying, restoreAuth]);

  if (isVerifying) {
    return <SpinnerOverlay delay={0} className="h-screen" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES_PATHS.AUTH.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
