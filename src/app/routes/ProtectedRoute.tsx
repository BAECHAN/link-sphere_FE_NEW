import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/domains/auth/_common/hooks/useAuth';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES_PATHS.AUTH.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
