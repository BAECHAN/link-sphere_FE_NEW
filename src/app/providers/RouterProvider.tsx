import { Suspense } from 'react';
import { createBrowserRouter, RouterProvider as RRRouterProvider } from 'react-router-dom';
import { appRoutes } from '@/app/routes';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { NavigationService } from '@/shared/lib/router/navigation';
import { RouterEvents } from '@/shared/lib/router/router-events';
import { AuthUtil } from '@/shared/utils/auth.util';

const router = createBrowserRouter(appRoutes, {
  future: {
    v7_relativeSplatPath: true,
  },
});

NavigationService.setNavigate(router.navigate.bind(router));
RouterEvents.setSource(router);
// 로그인이 풀린 채 둔 화면(auth.store signedOutInPlace)을 떠나면 그 표시를 내린다. 라우터 구독은 React가 새 화면을
// 그리기 전에 불려, 새 화면의 ProtectedRoute·401 처리가 처음부터 평소대로 동작한다(router-events.ts)
RouterEvents.onNavigate((location) => AuthUtil.leaveSignedOutInPlace(location.pathname));

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
