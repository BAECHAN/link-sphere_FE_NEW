import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { AuthUtil } from '@/shared/utils/auth.util';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { useLoginModalStore } from '@/shared/store/loginModal.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, accessToken, restoreAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const openLoginModal = useLoginModalStore((state) => state.open);

  // 액세스 토큰이 있지만 만료됐으면 즉시 리프레시 시도 (콘텐츠 flash 방지)
  const [isVerifying, setIsVerifying] = useState(
    () => !!accessToken && AuthUtil.isTokenExpired(accessToken)
  );

  useEffect(() => {
    if (!isVerifying) return;
    restoreAuth().finally(() => setIsVerifying(false));
  }, [isVerifying, restoreAuth]);

  // 이 마운트에서 한 번이라도 로그인 상태였는지 추적.
  // - 처음부터 비로그인 = 보호 페이지 "접근 시도" → 로그인 모달을 띄운다.
  // - 로그인 상태였다가 false = 로그아웃/세션만료 → 모달 없이 조용히 피드로 보낸다.
  const hasBeenAuthenticated = useRef(isAuthenticated);
  if (isAuthenticated) hasBeenAuthenticated.current = true;

  // 비로그인 접근 시도일 때만: 로그인 페이지로 튕기지 않고 공개 피드를 배경으로
  // 두고 로그인 모달을 띄운다. 로그인 성공 시 원래 페이지로 복귀.
  const intendedPath = location.pathname + location.search;
  useEffect(() => {
    if (isVerifying || isAuthenticated || hasBeenAuthenticated.current) return;
    openLoginModal(() => navigate(intendedPath, { replace: true }));
  }, [isVerifying, isAuthenticated, openLoginModal, navigate, intendedPath]);

  if (isVerifying) {
    return <SpinnerOverlay delay={0} className="h-screen" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES_PATHS.POST.ROOT} replace />;
  }

  return <>{children}</>;
}
