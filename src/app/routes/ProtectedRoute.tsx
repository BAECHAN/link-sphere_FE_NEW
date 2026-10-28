import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/entities/auth/hooks/useAuth';
import { useAuthStore } from '@/shared/store/auth.store';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import {
  useLoginDialogStore,
  type LoginDialogLocationState,
} from '@/shared/store/loginDialog.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const setLoginOnSuccess = useLoginDialogStore((state) => state.setOnSuccess);
  // AuthProvider가 더 이상 렌더를 막지 않으므로, 첫 페인트 시점엔 복원이 끝나기 전이라
  // isAuthenticated가 아직 false다. 이 값을 기다리지 않으면 로그인 사용자가
  // 보호 페이지를 새로고침할 때 피드로 튕기고 로그인 모달까지 뜬다.
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  // 로그인이 풀렸지만 이 화면에 그대로 두는 중(만료, 쓰는 중 다른 탭 로그아웃) - 로그인 창은 AuthUtil이 연다
  // (docs/plans/2026-10-28-keep-writing-in-place.md)
  const signedOutInPlacePathname = useAuthStore(
    (state) => state.signedOutInPlace?.pathname ?? null
  );
  // 그 표시는 다른 화면으로 가는 순간 내려가는데(RouterProvider의 라우터 구독), 새 위치가 커밋되기 전에 이 화면이 한 번
  // 더 그려진다(v7_startTransition - 라우터 갱신은 transition, 스토어 갱신은 동기). 전역 값만 보면 그 렌더에서 피드로
  // 보내 고른 화면 대신 /post에 도착했다. 그래서 표시를 세운 화면을 붙잡아 두고, 지금 그리는 위치와 비교한다.
  // 렌더 중에 읽으므로 hasBeenAuthenticated와 같이 state로 들고 렌더 중에 맞춘다.
  const [keptPathname, setKeptPathname] = useState(signedOutInPlacePathname);

  if (isAuthenticated && keptPathname !== null) {
    setKeptPathname(null);
  }

  if (
    !isAuthenticated &&
    signedOutInPlacePathname !== null &&
    signedOutInPlacePathname !== keptPathname
  ) {
    setKeptPathname(signedOutInPlacePathname);
  }

  const isSignedOutInPlace = !isAuthenticated && keptPathname === location.pathname;
  const isLoginDialogOpen = Boolean(
    (location.state as LoginDialogLocationState | null)?.loginDialogOpen
  );

  // 이 마운트에서 한 번이라도 로그인 상태였는지 추적.
  // - 처음부터 비로그인 = 보호 페이지 "접근 시도" → 로그인 모달을 띄운다.
  // - 로그인 상태였다가 false = 로그아웃 → 모달 없이 조용히 피드로 보낸다(이 화면에 두는 만료 등은 isSignedOutInPlace).
  // 렌더 중에 읽으므로 ref가 아니라 state로 들고, 렌더 중에 맞춘다
  // (https://react.dev/reference/eslint-plugin-react-hooks/lints/refs)
  const [hasBeenAuthenticated, setHasBeenAuthenticated] = useState(isAuthenticated);
  if (isAuthenticated && !hasBeenAuthenticated) {
    setHasBeenAuthenticated(true);
  }

  // 비로그인 접근 시도일 때만: 로그인 페이지로 튕기지 않고 공개 피드를 배경으로
  // 두고 로그인 모달을 띄운다. 로그인 성공 시 원래 페이지로 복귀.
  const intendedPath = location.pathname + location.search;
  useEffect(
    function setLoginCallbackWhenUnauthenticated() {
      if (!isAuthResolved || isAuthenticated || hasBeenAuthenticated || isSignedOutInPlace) {
        return;
      }
      setLoginOnSuccess(() => navigate(intendedPath, { replace: true }));
    },
    [
      isAuthResolved,
      isAuthenticated,
      hasBeenAuthenticated,
      isSignedOutInPlace,
      setLoginOnSuccess,
      navigate,
      intendedPath,
    ]
  );

  // 로그인이 풀린 채 둔 화면에서 로그인 창이 열렸다가 로그인 없이 닫히면 피드로 보낸다 - 이 화면은 로그인해야 쓸 수
  // 있다. 쓰는 중이면 이탈 확인창이 이 이동을 막고, "계속 작성"을 고르면 로그아웃 상태로 남는다. 한 번만 보낸다 -
  // 다시 보내거나 창을 다시 열면 계속 쓰기로 한 사용자가 같은 확인을 되풀이하게 된다.
  // 렌더에 쓰지 않는 값이라 ref로 들고 effect에서만 읽고 쓴다(https://react.dev/reference/react/useRef)
  const signInDialogShownRef = useRef(false);
  const leftForFeedRef = useRef(false);

  useEffect(
    function leaveWhenSignInDialogClosedWithoutSignIn() {
      if (isAuthenticated || !isSignedOutInPlace) {
        signInDialogShownRef.current = false;
        leftForFeedRef.current = false;
        return;
      }

      if (isLoginDialogOpen) {
        signInDialogShownRef.current = true;
        return;
      }

      if (!signInDialogShownRef.current || leftForFeedRef.current) {
        return;
      }

      leftForFeedRef.current = true;
      navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
    },
    [isAuthenticated, isSignedOutInPlace, isLoginDialogOpen, navigate]
  );

  if (!isAuthResolved) {
    return <SpinnerOverlay className="h-screen" />;
  }

  if (!isAuthenticated && !isSignedOutInPlace) {
    // 리다이렉트와 모달 오픈을 같은 Navigate에 실어 원자적으로 처리한다 (별도로 navigate를 한 번 더
    // 호출하면 이 replace와 순서가 겹쳐 레이스가 생긴다). 로그아웃/세션만료 시(hasBeenAuthenticated)는
    // 모달 없이 조용히 피드로 보내야 하므로 그 경우에만 state를 비운다.
    return (
      <Navigate
        to={ROUTES_PATHS.POST.ROOT}
        replace
        state={hasBeenAuthenticated ? undefined : { loginDialogOpen: true }}
      />
    );
  }

  return <>{children}</>;
}
