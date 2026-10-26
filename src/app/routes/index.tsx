import React, { lazy, Suspense } from 'react';
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { ProtectedLayout } from './layouts/ProtectedLayout';
import { AppShellLayout } from '@/app/routes/layouts/AppShellLayout';
import { PublicLayout } from '@/app/routes/layouts/PublicLayout';
import { RootLayout } from '@/app/routes/layouts/RootLayout';
import { RouteErrorBoundary } from '@/app/routes/RouteErrorBoundary';
import { usePrefetchCategoryOptions } from '@/entities/category/api/category.queries';
import { usePrefetchComments } from '@/entities/comment/api/comment.queries';
import { usePrefetchPostDetail } from '@/entities/post/api/post.queries';
import { usePostFeedPrefetch } from '@/widgets/post/post-list/hooks/usePostFeedPrefetch';
import { useAuthStore } from '@/shared/store/auth.store';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { AuthLayout } from '@/shared/ui/layouts/AuthLayout';

const NotFoundPage = lazy(() =>
  import('@/pages/404/NotFoundPage').then((module) => ({ default: module.NotFoundPage }))
);
const ForbiddenPage = lazy(() =>
  import('@/pages/403/ForbiddenPage').then((module) => ({ default: module.ForbiddenPage }))
);
const ServerErrorPage = lazy(() =>
  import('@/pages/500/ServerErrorPage').then((module) => ({ default: module.ServerErrorPage }))
);
const VersionPage = lazy(() =>
  import('@/pages/version/VersionPage').then((module) => ({ default: module.VersionPage }))
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
const BookmarkPage = lazy(() =>
  import('@/pages/bookmark/BookmarkPage').then((module) => ({ default: module.BookmarkPage }))
);
const MyCommentPage = lazy(() =>
  import('@/pages/mycomment/MyCommentPage').then((module) => ({ default: module.MyCommentPage }))
);
const MyAccountPage = lazy(() =>
  import('@/pages/myaccount/MyAccountPage').then((module) => ({ default: module.MyAccountPage }))
);
const SignUpPage = lazy(() =>
  import('@/pages/auth/SignUpPage').then((module) => ({ default: module.SignUpPage }))
);
const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage }))
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  }))
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  }))
);
const VerifyEmailPage = lazy(() =>
  import('@/pages/auth/VerifyEmailPage').then((module) => ({
    default: module.VerifyEmailPage,
  }))
);
/**
 * Lazy 컴포넌트를 Suspense로 감싸는 래퍼
 * 각 페이지별로 로딩 상태를 관리하여 깜빡임 방지
 * SpinnerOverlay의 기본 지연 게이트(LOADING_INDICATOR_DELAY_MS)를 그대로 쓴다
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
 * 루트 경로('/') 접근 시 게시글 목록으로 리다이렉트
 * 비로그인 사용자도 공개 목록을 진입점으로 사용한다.
 */
function RootRedirect() {
  return <Navigate to={ROUTES_PATHS.POST.ROOT} replace />;
}

/**
 * 피드 목록 첫 페이지 요청을 페이지 청크와 같은 렌더에서 시작한다. URL과 봇 숨기기 설정을 구독하므로
 * PostFeedRoute가 아니라 따로 둔 이 컴포넌트에서 부른다 - PostFeedRoute가 구독하면 오버레이 열기처럼
 * 위치만 바뀌어도 페이지 전체가 다시 렌더된다(지금은 페이지 안에서 구독하는 컴포넌트만 렌더된다).
 */
function PostFeedPrefetch() {
  usePostFeedPrefetch();

  return null;
}

/**
 * 게시글 목록(피드) 라우트 — 페이지 청크를 요청하는 같은 렌더에서 필터 카드의 카테고리와 목록 첫 페이지도
 * 요청한다. 필터 카드의 useQuery는 커밋 뒤에야 요청하므로, 페이지 첫 커밋이 게시글을 기다리거나(청크가 빨리
 * 온 경우) 청크가 늦게 와 카드가 먼저 그려지면 칩이 뒤늦게 들어와 그 아래가 밀렸다(docs/SEARCH.md §10).
 * 목록도 청크 안에서만 요청하면 청크 다운로드 → 목록 요청 → 썸네일(LCP)이 차례로 이어진다.
 * lazy 청크 밖에 있어 이 라우트에 들어올 때마다 페이지보다 먼저 렌더된다.
 */
function PostFeedRoute() {
  usePrefetchCategoryOptions();

  return (
    <>
      <PostFeedPrefetch />
      {withSuspense(Post)}
    </>
  );
}

/**
 * 게시글 상세 라우트 — 페이지 청크를 요청하는 같은 렌더에서 게시글과 댓글을 함께 요청한다. 페이지 안에서
 * 요청하면 청크 다운로드 → 게시글 요청 → 썸네일(LCP)이 차례로 이어진다. 댓글은 게시글을 기다리는 경계
 * 안쪽(CommentList)에서야 마운트되므로 게시글과 동시에 시작한다.
 */
function PostDetailRoute() {
  const { id } = useParams<{ id: string }>();
  usePrefetchPostDetail(id || '');
  usePrefetchComments(id || '');

  return withSuspense(PostDetailPage);
}
/**
 * App Routes Configuration
 * Route Objects 배열 방식으로 라우팅 설정
 * 레이아웃 컴포넌트를 React.memo로 최적화하여 불필요한 리렌더링 방지
 */
export const appRoutes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // Public Content Group (shell 있음, 인증 게이트 없음 — 비로그인 열람 가능)
      {
        element: <AppShellLayout />,
        children: [
          {
            path: ROUTES_PATHS.HOME,
            element: <RootRedirect />,
          },
          {
            path: ROUTES_PATHS.POST.ROOT,
            element: <PostFeedRoute />,
          },
          {
            path: '/post/:id',
            element: <PostDetailRoute />,
          },
        ],
      },
      // Protected Content Group (인증 필요 — 쓰기/소유 행위)
      {
        element: <ProtectedLayout />,
        children: [
          {
            path: ROUTES_PATHS.POST.SUBMIT,
            element: withSuspense(PostSubmitPage),
          },
          {
            path: ROUTES_PATHS.POST.EDIT,
            element: withSuspense(PostEditPage),
          },
          {
            path: ROUTES_PATHS.BOOKMARK,
            element: withSuspense(BookmarkPage),
          },
          {
            path: ROUTES_PATHS.MY_COMMENTS,
            element: withSuspense(MyCommentPage),
          },
          {
            path: ROUTES_PATHS.MY_ACCOUNT,
            element: withSuspense(MyAccountPage),
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
          {
            path: ROUTES_PATHS.AUTH.FORGOT_PASSWORD,
            element: withSuspense(ForgotPasswordPage),
          },
          {
            path: ROUTES_PATHS.AUTH.RESET_PASSWORD,
            element: withSuspense(ResetPasswordPage),
          },
        ],
      },
      // 이메일 인증 확인 링크 - 로그인·비로그인 둘 다 접근 가능해야 하므로(로그인 상태면
      // 인증 완료만 안내, 비로그인이면 로그인 유도) GuestGuard로 감싸지 않는다. 다른 인증
      // 화면과 같은 시각 스타일(AuthLayout)만 직접 씌운다.
      {
        path: ROUTES_PATHS.AUTH.VERIFY_EMAIL,
        element: <AuthLayout>{withSuspense(VerifyEmailPage)}</AuthLayout>,
      },
      // 배포 반영 확인 - AppShellLayout의 인증 복원 스피너에 발목 잡히지 않도록 직속에 둔다
      {
        path: ROUTES_PATHS.VERSION,
        element: withSuspense(VersionPage),
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
