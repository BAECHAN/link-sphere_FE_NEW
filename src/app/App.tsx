import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { FallbackProps } from 'react-error-boundary';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { AppErrorFallback } from '@/shared/ui/elements/AppErrorFallback';
import { RouterProvider } from '@/app/providers/RouterProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';

/**
 * Router 트리 바깥(Provider·RouterProvider 자체)에서 터진 에러의 최후 방어선.
 * 라우트 안에서 터진 에러는 루트 라우트의 RouteErrorBoundary가 먼저 잡는다.
 */
function GlobalErrorFallback({ error }: FallbackProps) {
  return <AppErrorFallback error={error as unknown} />;
}

export function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <AsyncBoundary errorFallback={GlobalErrorFallback} onReset={reset}>
          <AuthProvider>
            <TooltipProvider delayDuration={0}>
              <RouterProvider />
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </AsyncBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
