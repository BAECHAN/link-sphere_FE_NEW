import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider as RRRouterProvider } from 'react-router-dom';
import { appRoutes } from '@/app/routes';
import { Spinner } from '@/shared/ui/atoms/spinner';

const router = createBrowserRouter(appRoutes, {
  future: {
    v7_relativeSplatPath: true,
  },
});

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
