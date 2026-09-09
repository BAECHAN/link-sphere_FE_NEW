import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { useAppVersionCheck } from '@/shared/hooks/useAppVersionCheck';
import { useNewVersionReload } from '@/shared/hooks/useNewVersionReload';
import { LoginModal } from '@/features/auth/login/ui/LoginModal';
import { GlobalImageViewer } from '@/shared/ui/elements/modal/image-viewer/ImageViewer';
import { GlobalAlerts } from '@/shared/ui/elements/modal/alert/Alert';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

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
      <LoginModal />
      <GlobalImageViewer />
      <GlobalAlerts />
    </>
  );
}
