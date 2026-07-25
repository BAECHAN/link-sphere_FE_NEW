import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { useAuthStore } from '@/shared/store/auth.store';
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
  // AuthProvider가 더 이상 렌더를 막지 않으므로, 첫 페인트 시점엔 복원이 끝나기 전이라
  // isAuthenticated가 아직 false다. 이 값을 기다리지 않으면 로그인 사용자가
  // 보호 페이지를 새로고침할 때 피드로 튕기고 로그인 모달까지 뜬다.
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);

  // 액세스 토큰이 있지만 만료됐으면 즉시 리프레시 시도 (콘텐츠 flash 방지)
  const [isVerifying, setIsVerifying] = useState(
    () => !!accessToken && AuthUtil.isTokenExpired(accessToken)
  );

  useEffect(() => {
    if (!isVerifying) {
      return;
    }
    restoreAuth().finally(() => setIsVerifying(false));
  }, [isVerifying, restoreAuth]);

  // 이 마운트에서 한 번이라도 로그인 상태였는지 추적.
  // - 처음부터 비로그인 = 보호 페이지 "접근 시도" → 로그인 모달을 띄운다.
  // - 로그인 상태였다가 false = 로그아웃/세션만료 → 모달 없이 조용히 피드로 보낸다.
  const hasBeenAuthenticated = useRef(isAuthenticated);
  if (isAuthenticated) {
    hasBeenAuthenticated.current = true;
  }

  // 비로그인 접근 시도일 때만: 로그인 페이지로 튕기지 않고 공개 피드를 배경으로
  // 두고 로그인 모달을 띄운다. 로그인 성공 시 원래 페이지로 복귀.
  const intendedPath = location.pathname + location.search;
  useEffect(
    function openLoginModalWhenUnauthenticated() {
      if (!isAuthResolved || isVerifying || isAuthenticated || hasBeenAuthenticated.current) {
        return;
      }
      openLoginModal(() => navigate(intendedPath, { replace: true }));
    },
    [isAuthResolved, isVerifying, isAuthenticated, openLoginModal, navigate, intendedPath]
  );

  if (!isAuthResolved || isVerifying) {
    return <SpinnerOverlay delay={0} className="h-screen" />;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES_PATHS.POST.ROOT} replace />;
  }

  return <>{children}</>;
}
