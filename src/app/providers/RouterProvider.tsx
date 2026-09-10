import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider as RRRouterProvider } from 'react-router-dom';
import { appRoutes } from '@/app/routes';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { NavigationService } from '@/shared/lib/router/navigation';

const router = createBrowserRouter(appRoutes, {
  future: {
    v7_relativeSplatPath: true,
  },
});

NavigationService.setNavigate(router.navigate.bind(router));

export function RouterProvider() {
  return (
    <Suspense fallback={<SpinnerOverlay className="h-screen" />}>
      <RRRouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
    </Suspense>
  );
}
