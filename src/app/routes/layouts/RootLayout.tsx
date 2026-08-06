import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard';
import { LoginModal } from '@/features/auth/login/ui/LoginModal';

/**
 * Root Layout
 * Provides ScrollRestoration for the entire router
 */
export function RootLayout() {
  useFcmForegroundMessage();
  useUnsavedChangesGuard();

  return (
    <>
      <ScrollRestoration />
      <Outlet />
      <LoginModal />
    </>
  );
}
