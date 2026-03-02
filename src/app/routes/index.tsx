import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation, type RouteObject } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { ProtectedLayout } from './layouts/ProtectedLayout';
import { PublicLayout } from '@/app/routes/layouts/PublicLayout';
import { RootLayout } from '@/app/routes/layouts/RootLayout';
import { useAuthStore } from '@/shared/store/auth.store';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

const NotFoundPage = lazy(() =>
  import('@/pages/404/NotFoundPage').then((module) => ({ default: module.NotFoundPage }))
);
const ForbiddenPage = lazy(() =>
  import('@/pages/403/ForbiddenPage').then((module) => ({ default: module.ForbiddenPage }))
);
const ServerErrorPage = lazy(() =>
  import('@/pages/500/ServerErrorPage').then((module) => ({ default: module.ServerErrorPage }))
);
const Post = lazy(() => import('@/pages/post').then((module) => ({ default: module.Post })));
const PostSubmitPage = lazy(() =>
  import('@/pages/post/PostSubmitPage').then((module) => ({ default: module.PostSubmitPage }))
);
const PostDetailPage = lazy(() =>
  import('@/pages/post/PostDetailPage').then((module) => ({ default: module.PostDetailPage }))
);
const PostEditPage = lazy(() =>
  import('@/pages/post/PostEditPage').then((module) => ({ default: module.PostEditPage }))
);
const SignUpPage = lazy(() =>
  import('@/pages/auth/SignUpPage').then((module) => ({ default: module.SignUpPage }))
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

interface LocationState {
  from?: Location;
}

/**
 * 비로그인 사용자 전용 가드 (Guest Guard)
 * 로그인된 상태에서 접근 시 이전 페이지 또는 루트 경로로 리다이렉트합니다.
 */
function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  // 이미 로그인된 상태라면 리다이렉트 처리
  if (isAuthenticated) {
    const state = location.state as LocationState | null;
    const previousPath = state?.from?.pathname;

    return <Navigate to={previousPath ?? ROUTES_PATHS.HOME} replace />;
  }

  return <>{children}</>;
}

/**
 * 루트 경로('/') 접근 시 리다이렉트 처리
 */
function RootRedirect() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES_PATHS.AUTH.LOGIN} replace />;
  }

  return <Navigate to={ROUTES_PATHS.POST.ROOT} replace />;
}
/**
 * App Routes Configuration
 * Route Objects 배열 방식으로 라우팅 설정
 * 레이아웃 컴포넌트를 React.memo로 최적화하여 불필요한 리렌더링 방지
 */
export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
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
            element: withSuspense(PostSubmitPage),
          },
          {
            path: '/post/:id',
            element: withSuspense(PostDetailPage),
          },
          {
            path: ROUTES_PATHS.POST.EDIT,
            element: withSuspense(PostEditPage),
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
          {
            path: ROUTES_PATHS.AUTH.SIGNUP,
            element: withSuspense(SignUpPage),
          },
        ],
      },
      // 403 Forbidden
      {
        path: ROUTES_PATHS.FORBIDDEN,
        element: withSuspense(ForbiddenPage),
      },
      // 500 Server Error
      {
        path: ROUTES_PATHS.SERVER_ERROR,
        element: withSuspense(ServerErrorPage),
      },
      // 404 Not Found
      {
        path: ROUTES_PATHS.NOT_FOUND,
        element: withSuspense(NotFoundPage),
      },
    ],
  },
];
