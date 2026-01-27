import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { ProtectedLayout } from './layouts/ProtectedLayout';
import { PublicLayout } from '@/app/routes/layouts/PublicLayout';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { MemberRole } from '@/domains/member/_common/model/member.schema';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

const NotFoundPage = lazy(() =>
  import('@/pages/404/NotFoundPage').then((module) => ({ default: module.NotFoundPage }))
);
const ForbiddenPage = lazy(() =>
  import('@/pages/403/ForbiddenPage').then((module) => ({ default: module.ForbiddenPage }))
);
const Post = lazy(() => import('@/pages/post').then((module) => ({ default: module.Post })));
const PostSubmit = lazy(() =>
  import('@/pages/post/Submit').then((module) => ({ default: module.PostSubmit }))
);
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage }))
);
/**
 * Lazy 컴포넌트를 Suspense로 감싸는 래퍼
 * 각 페이지별로 로딩 상태를 관리하여 깜빡임 방지
 * GlobalLoading을 delay=0으로 사용하여 즉시 표시
 */
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => {
  return (
    <Suspense fallback={<SpinnerOverlay />}>
      <Component />
    </Suspense>
  );
};

/** 권한별 접근 가능한 경로 Prefix 정의 */
const ROLE_ACCESS_PATHS: Record<MemberRole, string[]> = {
  ADMIN: ['/admin', '/user'],
  USER: ['/user'],
};

/** 권한별 기본 대시보드 경로 반환 */
const getRootPath = (role: MemberRole | null) => {
  if (role === 'ADMIN') {
    return ROUTES_PATHS.HOME;
  }
  return ROUTES_PATHS.POST.ROOT;
};

/** 해당 권한으로 경로에 접근 가능한지 확인 */
const canAccessPath = (role: MemberRole | null, path: string) => {
  if (!role) return false;
  const allowedPrefixes = ROLE_ACCESS_PATHS[role] || [];
  return allowedPrefixes.some((prefix) => path.startsWith(prefix));
};

interface LocationState {
  from?: Location;
}

/**
 * 비로그인 사용자 전용 가드 (Guest Guard)
 * 로그인된 상태에서 접근 시 이전 페이지 또는 루트 경로로 리다이렉트합니다.
 */
function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role } = useAuthStore();
  const location = useLocation();

  // 이미 로그인된 상태라면 리다이렉트 처리
  if (isAuthenticated) {
    const state = location.state as LocationState | null;
    const previousPath = state?.from?.pathname;

    // 1. 이전 경로가 있고, 현재 권한으로 접근 가능하다면 그곳으로 이동
    if (previousPath && canAccessPath(role, previousPath)) {
      return <Navigate to={previousPath} replace />;
    }

    // 2. 그 외에는 권한별 루트 경로로 이동
    return <Navigate to={getRootPath(role)} replace />;
  }

  // 비로그인 상태면 정상 렌더링
  return <>{children}</>;
}

/**
 * 루트 경로('/') 접근 시 리다이렉트 처리
 */
function RootRedirect() {
  const { role, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES_PATHS.AUTH.LOGIN} replace />;
  }

  return <Navigate to={getRootPath(role)} replace />;
}

/**
 * App Routes Configuration
 * Route Objects 배열 방식으로 라우팅 설정
 * 레이아웃 컴포넌트를 React.memo로 최적화하여 불필요한 리렌더링 방지
 */
export const appRoutes: RouteObject[] = [
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: ROUTES_PATHS.HOME,
        element: <RootRedirect />,
      },
      {
        path: ROUTES_PATHS.POST.ROOT,
        element: withSuspense(Post),
      },
      {
        path: ROUTES_PATHS.POST.SUBMIT,
        element: withSuspense(PostSubmit),
      },
    ],
  },
  // Public Routes Group (Guest Only)
  {
    element: (
      <GuestGuard>
        <PublicLayout />
      </GuestGuard>
    ),
    children: [
      {
        path: ROUTES_PATHS.AUTH.LOGIN,
        element: withSuspense(LoginPage),
      },
    ],
  },
  // 403 Forbidden
  {
    path: ROUTES_PATHS.FORBIDDEN,
    element: withSuspense(ForbiddenPage),
  },
  // 404 Not Found
  {
    path: ROUTES_PATHS.NOT_FOUND,
    element: withSuspense(NotFoundPage),
  },
];
