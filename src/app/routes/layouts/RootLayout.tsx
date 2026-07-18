import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';
import { LoginModal } from '@/features/auth/login/ui/LoginModal';

/**
 * Root Layout
 * Provides ScrollRestoration for the entire router
 */
export function RootLayout() {
  useFcmForegroundMessage();

  return (
    <>
      <ScrollRestoration />
      <Outlet />
      <LoginModal />
    </>
  );
}
