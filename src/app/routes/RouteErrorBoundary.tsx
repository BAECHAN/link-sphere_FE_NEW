import { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';
import { AppErrorFallback } from '@/shared/ui/elements/AppErrorFallback';

/**
 * 루트 라우트의 errorElement
 *
 * react-router의 data router는 errorElement 유무와 무관하게 index-0 라우트를 자체
 * RenderErrorBoundary로 감싸며, errorElement가 없으면 스택 트레이스를 그대로 노출하는
 * DefaultErrorComponent를 렌더한다(프로덕션 포함). 루트에 이 컴포넌트를 지정해 그 화면이
 * 사용자에게 도달하지 않게 한다.
 *
 * 라우트 트리 안(RootLayout 자신 포함)에서 던져진 모든 에러 - lazy 청크 로드 실패까지 -
 * 가 여기로 모인다. 여기서 또 throw하면 RouterProvider 밖의 GlobalErrorFallback으로
 * 넘어간다.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  useEffect(() => {
    console.error('[RouteError]', error);
  }, [error]);

  return <AppErrorFallback error={error} />;
}
