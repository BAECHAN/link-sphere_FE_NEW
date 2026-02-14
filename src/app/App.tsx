import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { RouterProvider } from '@/app/providers/RouterProvider';
import { AuthProvider } from '@/app/providers/AuthProvider';

export function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <AsyncBoundary onReset={reset}>
          <AuthProvider>
            <RouterProvider />
          </AuthProvider>
        </AsyncBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
