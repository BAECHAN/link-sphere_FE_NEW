import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { RouterProvider } from '@/app/providers/RouterProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';

export function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <AsyncBoundary onReset={reset}>
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
