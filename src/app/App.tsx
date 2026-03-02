import { useEffect } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { FallbackProps } from 'react-error-boundary';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { RouterProvider } from '@/app/providers/RouterProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { GlobalAlerts } from '@/shared/ui/elements/modal/alert/Alert';
import { ApiError } from '@/shared/types/common.type';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

/**
 * 5xx 서버 에러 또는 네트워크 단절 여부를 판단
 */
function isServerError(error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 500) return true;
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true;
  return false;
}

/**
 * 전역 ErrorBoundary 폴백
 * - 5xx / 네트워크 에러 → /500 페이지로 리다이렉트
 * - 그 외 에러 → 현재 위치에서 인라인 에러 메시지 표시 (Router 외부라 navigate 불가)
 */
function GlobalErrorFallback({ error }: FallbackProps) {
  useEffect(() => {
    if (isServerError(error)) {
      window.location.replace(ROUTES_PATHS.SERVER_ERROR);
    }
  }, [error]);

  if (isServerError(error)) {
    return <SpinnerOverlay />;
  }

  const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-480 text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">오류 발생</h1>
        <p className="text-xl text-gray-600">{message}</p>
      </div>
    </div>
  );
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
              <GlobalAlerts />
            </TooltipProvider>
          </AuthProvider>
        </AsyncBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
