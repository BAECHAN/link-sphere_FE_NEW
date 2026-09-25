import { lazy, Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { useAppVersionCheck } from '@/shared/hooks/useAppVersionCheck';
import { useNewVersionReload } from '@/shared/hooks/useNewVersionReload';
import { GlobalImageViewer } from '@/shared/ui/elements/modal/image-viewer/ImageViewer';
import { GlobalAlerts } from '@/shared/ui/elements/modal/alert/Alert';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

// 비로그인 방문자 대다수는 한 번도 열지 않는 모달이라 초기 번들에서 뺀다(form-vendor
// 포함) - 실측: 2026-09-26 빌드에서 이 모듈이 진입 청크에 정적으로 포함돼 있었다
// (docs/plans/2026-09-25-lighthouse-perf.md 참고). fallback={null}인 자체 Suspense로
// 감싸 Outlet과 같은 경계를 타지 않게 한다 - 같은 경계였다면 이 청크가 늦게 도착할 때
// 페이지 본문까지 함께 멈춘다.
const LoginModal = lazy(() =>
  import('@/features/auth/login/ui/LoginModal').then((module) => ({
    default: module.LoginModal,
  }))
);

/**
 * Root Layout
 * Provides ScrollRestoration for the entire router
 */
export function RootLayout() {
  useFcmForegroundMessage();
  useUnsavedChangesGuard();
  useAppVersionCheck();

  const isReloadingForNewVersion = useNewVersionReload();

  // 새 배포 감지 후 첫 라우트 이동은 full page load로 대체한다. 구 빌드가 목적지를
  // 그리기 시작하면(페이지 청크 다운로드 + 그 페이지의 쿼리) 전부 버려질 작업이므로
  // Outlet 자체를 렌더하지 않는다 - AppShellLayout의 인증 대기 게이트와 같은 형태.
  if (isReloadingForNewVersion) {
    return <SpinnerOverlay className="h-screen" />;
  }

  return (
    <>
      <ScrollRestoration />
      <Outlet />
      <Suspense fallback={null}>
        <LoginModal />
      </Suspense>
      <GlobalImageViewer />
      <GlobalAlerts />
    </>
  );
}
