import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';

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
    </>
  );
}
