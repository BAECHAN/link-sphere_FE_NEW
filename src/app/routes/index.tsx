import React, { lazy, Suspense } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { AppLayout } from '@/shared/ui/layouts/AppLayout';

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
/**
 * Lazy 컴포넌트를 Suspense로 감싸는 래퍼
 * 각 페이지별로 로딩 상태를 관리하여 깜빡임 방지
 * GlobalLoading을 delay=0으로 사용하여 즉시 표시
 */
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Component />
    </Suspense>
  );
};

/**
 * App Routes Configuration
 * Route Objects 배열 방식으로 라우팅 설정
 * 레이아웃 컴포넌트를 React.memo로 최적화하여 불필요한 리렌더링 방지
 */
export const appRoutes: RouteObject[] = [
  {
    element: (
      <AppLayout>
        <Outlet />
      </AppLayout>
    ),
    children: [
      {
        path: ROUTES_PATHS.HOME,
        element: <Navigate to={ROUTES_PATHS.POST.ROOT} replace />,
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
