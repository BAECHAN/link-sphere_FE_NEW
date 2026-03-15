import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider as RRRouterProvider } from 'react-router-dom';
import { appRoutes } from '@/app/routes';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { NavigationService } from '@/shared/lib/router/navigation';

const router = createBrowserRouter(appRoutes, {
  future: {
    v7_relativeSplatPath: true,
  },
});

NavigationService.setNavigate(router.navigate.bind(router));

export function RouterProvider() {
  return (
    <Suspense fallback={<Spinner className="size-10 animate-spin" />}>
      <RRRouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
    </Suspense>
  );
}
