import { Outlet, ScrollRestoration } from 'react-router-dom';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';
import { DebugViewport } from '@/shared/ui/elements/DebugViewport';

/**
 * Root Layout
 * Provides ScrollRestoration for the entire router
 */
export function RootLayout() {
  useFcmForegroundMessage();

  return (
    <>
      <DebugViewport />
      <ScrollRestoration />
      <Outlet />
    </>
  );
}
