import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { RouterProvider } from './providers/RouterProvider';

export function App() {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <AsyncBoundary onReset={reset}>
          <RouterProvider />
        </AsyncBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
